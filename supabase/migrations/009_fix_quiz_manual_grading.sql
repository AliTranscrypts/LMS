-- Fix Quiz Manual Grading Migration
-- Version 9.0 - Properly track and update manual quiz grades
--
-- This migration fixes the bug where manual grading ADDS to scores
-- instead of REPLACING them. It:
-- 1. Adds a manual_grades column to track individual question manual scores
-- 2. Updates the manual_grade_quiz_question function to properly replace scores

-- ============================================
-- ADD MANUAL GRADES TRACKING COLUMN
-- ============================================
-- Stores individual manual grades: {question_id: {points: X, feedback: "...", graded_at: "...", graded_by: "..."}, ...}

ALTER TABLE quiz_attempts 
ADD COLUMN IF NOT EXISTS manual_grades JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN quiz_attempts.manual_grades IS 
'Tracks individual manual grades for each question: {question_id: {points, feedback, graded_at, graded_by}, ...}';


-- ============================================
-- FIXED MANUAL QUIZ GRADING FUNCTION
-- ============================================
-- Key fix: Track individual question grades and REPLACE instead of ADD

CREATE OR REPLACE FUNCTION manual_grade_quiz_question(
  p_attempt_id UUID,
  p_question_id TEXT,
  p_points_earned NUMERIC,
  p_grader_id UUID,
  p_feedback TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_attempt RECORD;
  v_quiz_config JSONB;
  v_questions JSONB;
  v_question JSONB;
  v_question_category TEXT;
  v_question_points INTEGER;
  v_old_manual_grade JSONB;
  v_old_points NUMERIC;
  v_updated_manual_grades JSONB;
  v_updated_category_scores JSONB;
  v_new_total_score NUMERIC;
  v_auto_graded_score NUMERIC;
  v_all_manual_points NUMERIC;
  v_result JSONB;
BEGIN
  -- Get the attempt record with quiz config
  SELECT qa.*, c.quiz_config 
  INTO v_attempt
  FROM quiz_attempts qa
  JOIN content c ON c.id = qa.quiz_id
  WHERE qa.id = p_attempt_id;
  
  IF v_attempt IS NULL THEN
    RAISE EXCEPTION 'Quiz attempt not found';
  END IF;
  
  v_quiz_config := v_attempt.quiz_config;
  v_questions := v_quiz_config->'questions';
  
  -- Find the question in the quiz config
  v_question := NULL;
  FOR i IN 0..jsonb_array_length(v_questions) - 1 LOOP
    IF (v_questions->i)->>'id' = p_question_id THEN
      v_question := v_questions->i;
      v_question_category := COALESCE(v_question->>'category', 'ku');
      v_question_points := COALESCE((v_question->>'points')::INTEGER, 1);
      EXIT;
    END IF;
  END LOOP;
  
  IF v_question IS NULL THEN
    RAISE EXCEPTION 'Question not found in quiz';
  END IF;
  
  -- Validate points
  IF p_points_earned < 0 OR p_points_earned > v_question_points THEN
    RAISE EXCEPTION 'Points earned must be between 0 and %', v_question_points;
  END IF;
  
  -- Get existing manual grades (or empty object)
  v_updated_manual_grades := COALESCE(v_attempt.manual_grades, '{}'::JSONB);
  
  -- Check if this question was previously manually graded
  v_old_manual_grade := v_updated_manual_grades->p_question_id;
  v_old_points := COALESCE((v_old_manual_grade->>'points')::NUMERIC, 0);
  
  -- Update the manual grades with the new grade for this question
  v_updated_manual_grades := jsonb_set(
    v_updated_manual_grades,
    ARRAY[p_question_id],
    jsonb_build_object(
      'points', p_points_earned,
      'feedback', p_feedback,
      'graded_at', NOW(),
      'graded_by', p_grader_id
    )
  );
  
  -- Calculate new category score:
  -- (old category score) - (old manual points for this question) + (new points)
  v_updated_category_scores := jsonb_set(
    v_attempt.category_scores,
    ARRAY[v_question_category],
    to_jsonb(
      COALESCE((v_attempt.category_scores->>v_question_category)::NUMERIC, 0)
      - v_old_points  -- Subtract the old manual grade (0 if first time)
      + p_points_earned  -- Add the new grade
    )
  );
  
  -- Calculate new total score:
  -- (old total) - (old manual points for this question) + (new points)
  v_new_total_score := v_attempt.total_score - v_old_points + p_points_earned;
  
  -- Update the quiz attempt
  UPDATE quiz_attempts 
  SET 
    manual_grades = v_updated_manual_grades,
    category_scores = v_updated_category_scores,
    total_score = v_new_total_score,
    is_graded = TRUE
  WHERE id = p_attempt_id;
  
  -- Update or insert grade record
  INSERT INTO grades (
    assignment_id,
    student_id,
    category_scores,
    total_score,
    max_score,
    feedback,
    graded_at,
    graded_by
  ) VALUES (
    v_attempt.quiz_id,
    v_attempt.student_id,
    v_updated_category_scores,
    v_new_total_score,
    v_attempt.max_score,
    p_feedback,
    NOW(),
    p_grader_id
  )
  ON CONFLICT (assignment_id, student_id) 
  DO UPDATE SET
    category_scores = EXCLUDED.category_scores,
    total_score = EXCLUDED.total_score,
    feedback = COALESCE(EXCLUDED.feedback, grades.feedback),
    graded_at = EXCLUDED.graded_at,
    graded_by = EXCLUDED.graded_by;
  
  -- Build result
  v_result := jsonb_build_object(
    'success', TRUE,
    'attempt_id', p_attempt_id,
    'question_id', p_question_id,
    'points_earned', p_points_earned,
    'old_points', v_old_points,
    'new_total_score', v_new_total_score,
    'max_score', v_attempt.max_score,
    'category_scores', v_updated_category_scores,
    'manual_grades', v_updated_manual_grades
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION manual_grade_quiz_question(UUID, TEXT, NUMERIC, UUID, TEXT) IS 
'Manually grades a single quiz question (for short answer/essay types).
Now properly tracks individual question grades and REPLACES scores instead of adding.
Returns the updated scores and manual grades data.';


-- ============================================
-- UPDATE GET QUIZ ATTEMPT FUNCTION TO INCLUDE MANUAL GRADES
-- ============================================
-- Must drop first because return type is changing (adding manual_grades column)

DROP FUNCTION IF EXISTS get_quiz_attempts_for_grading(UUID);

CREATE OR REPLACE FUNCTION get_quiz_attempts_for_grading(p_quiz_id UUID)
RETURNS TABLE (
  attempt_id UUID,
  student_id UUID,
  student_name TEXT,
  student_number TEXT,
  answers JSONB,
  category_scores JSONB,
  total_score NUMERIC,
  max_score INTEGER,
  submitted_at TIMESTAMPTZ,
  is_graded BOOLEAN,
  manual_grades JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qa.id as attempt_id,
    qa.student_id,
    p.full_name as student_name,
    p.student_id as student_number,
    qa.answers,
    qa.category_scores,
    qa.total_score,
    qa.max_score,
    qa.submitted_at,
    qa.is_graded,
    COALESCE(qa.manual_grades, '{}'::JSONB) as manual_grades
  FROM quiz_attempts qa
  JOIN profiles p ON p.id = qa.student_id
  WHERE qa.quiz_id = p_quiz_id
  ORDER BY qa.submitted_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

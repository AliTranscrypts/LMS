-- Enhanced Grading Function Migration
-- Version 4.0 - Improved edge case handling for Ontario curriculum grading

-- ============================================
-- DROP EXISTING FUNCTION TO REPLACE IT
-- ============================================
DROP FUNCTION IF EXISTS calculate_student_grade(UUID, UUID);

-- ============================================
-- ENHANCED GRADING FUNCTION
-- ============================================
-- This function calculates student grades using the Ontario curriculum formula:
-- 1. Only "OF Learning" assignments count toward final grade
-- 2. Category scores are accumulated separately
-- 3. Each category percentage is weighted by course weights
-- 4. When categories have no grades, only graded categories contribute (normalized)
--
-- Example:
-- Course weights: K&U 80%, Application 20%
-- Student scores: K&U 3/6 (50%), Application 6/6 (100%)
-- Final grade: (50% × 80%) + (100% × 20%) = 40% + 20% = 60%

CREATE OR REPLACE FUNCTION calculate_student_grade(p_student_id UUID, p_course_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_course_weights JSONB;
  v_result JSONB;
  v_category_totals JSONB := '{"ku": 0, "thinking": 0, "application": 0, "communication": 0}'::JSONB;
  v_category_max JSONB := '{"ku": 0, "thinking": 0, "application": 0, "communication": 0}'::JSONB;
  v_category_percentages JSONB;
  v_final_grade NUMERIC;
  v_total_weight NUMERIC := 0;
  v_weighted_sum NUMERIC := 0;
  v_has_any_grades BOOLEAN := FALSE;
  v_categories_with_grades INTEGER := 0;
  rec RECORD;
BEGIN
  -- Get course category weights
  SELECT category_weights INTO v_course_weights
  FROM courses WHERE id = p_course_id;
  
  -- If course doesn't exist or has no weights, return empty result
  IF v_course_weights IS NULL THEN
    RETURN jsonb_build_object(
      'final_grade', NULL,
      'categories', jsonb_build_object(
        'ku', NULL,
        'thinking', NULL,
        'application', NULL,
        'communication', NULL
      ),
      'has_grades', FALSE,
      'graded_assignments_count', 0
    );
  END IF;
  
  -- Calculate category totals from OF Learning assignments only
  -- Use a cursor-like approach for better control
  FOR rec IN
    SELECT 
      g.category_scores,
      ct.category_weights as assignment_weights
    FROM grades g
    JOIN content ct ON ct.id = g.assignment_id
    JOIN modules m ON m.id = ct.module_id
    WHERE g.student_id = p_student_id
      AND m.course_id = p_course_id
      AND ct.evaluation_type = 'of'
  LOOP
    v_has_any_grades := TRUE;
    
    -- Accumulate scores for each category
    IF rec.category_scores ? 'ku' AND rec.assignment_weights ? 'ku' THEN
      v_category_totals := jsonb_set(
        v_category_totals, 
        '{ku}', 
        to_jsonb(COALESCE((v_category_totals->>'ku')::NUMERIC, 0) + COALESCE((rec.category_scores->>'ku')::NUMERIC, 0))
      );
      v_category_max := jsonb_set(
        v_category_max, 
        '{ku}', 
        to_jsonb(COALESCE((v_category_max->>'ku')::NUMERIC, 0) + COALESCE((rec.assignment_weights->>'ku')::NUMERIC, 0))
      );
    END IF;
    
    IF rec.category_scores ? 'thinking' AND rec.assignment_weights ? 'thinking' THEN
      v_category_totals := jsonb_set(
        v_category_totals, 
        '{thinking}', 
        to_jsonb(COALESCE((v_category_totals->>'thinking')::NUMERIC, 0) + COALESCE((rec.category_scores->>'thinking')::NUMERIC, 0))
      );
      v_category_max := jsonb_set(
        v_category_max, 
        '{thinking}', 
        to_jsonb(COALESCE((v_category_max->>'thinking')::NUMERIC, 0) + COALESCE((rec.assignment_weights->>'thinking')::NUMERIC, 0))
      );
    END IF;
    
    IF rec.category_scores ? 'application' AND rec.assignment_weights ? 'application' THEN
      v_category_totals := jsonb_set(
        v_category_totals, 
        '{application}', 
        to_jsonb(COALESCE((v_category_totals->>'application')::NUMERIC, 0) + COALESCE((rec.category_scores->>'application')::NUMERIC, 0))
      );
      v_category_max := jsonb_set(
        v_category_max, 
        '{application}', 
        to_jsonb(COALESCE((v_category_max->>'application')::NUMERIC, 0) + COALESCE((rec.assignment_weights->>'application')::NUMERIC, 0))
      );
    END IF;
    
    IF rec.category_scores ? 'communication' AND rec.assignment_weights ? 'communication' THEN
      v_category_totals := jsonb_set(
        v_category_totals, 
        '{communication}', 
        to_jsonb(COALESCE((v_category_totals->>'communication')::NUMERIC, 0) + COALESCE((rec.category_scores->>'communication')::NUMERIC, 0))
      );
      v_category_max := jsonb_set(
        v_category_max, 
        '{communication}', 
        to_jsonb(COALESCE((v_category_max->>'communication')::NUMERIC, 0) + COALESCE((rec.assignment_weights->>'communication')::NUMERIC, 0))
      );
    END IF;
  END LOOP;
  
  -- If no OF Learning grades exist, return null final grade
  IF NOT v_has_any_grades THEN
    RETURN jsonb_build_object(
      'final_grade', NULL,
      'categories', jsonb_build_object(
        'ku', NULL,
        'thinking', NULL,
        'application', NULL,
        'communication', NULL
      ),
      'has_grades', FALSE,
      'graded_assignments_count', 0
    );
  END IF;
  
  -- Calculate percentage for each category
  -- A category only has a percentage if there are points possible in that category
  v_category_percentages := jsonb_build_object(
    'ku', CASE 
      WHEN COALESCE((v_category_max->>'ku')::NUMERIC, 0) > 0 
      THEN ROUND(((v_category_totals->>'ku')::NUMERIC / (v_category_max->>'ku')::NUMERIC) * 100, 2)
      ELSE NULL 
    END,
    'thinking', CASE 
      WHEN COALESCE((v_category_max->>'thinking')::NUMERIC, 0) > 0 
      THEN ROUND(((v_category_totals->>'thinking')::NUMERIC / (v_category_max->>'thinking')::NUMERIC) * 100, 2)
      ELSE NULL 
    END,
    'application', CASE 
      WHEN COALESCE((v_category_max->>'application')::NUMERIC, 0) > 0 
      THEN ROUND(((v_category_totals->>'application')::NUMERIC / (v_category_max->>'application')::NUMERIC) * 100, 2)
      ELSE NULL 
    END,
    'communication', CASE 
      WHEN COALESCE((v_category_max->>'communication')::NUMERIC, 0) > 0 
      THEN ROUND(((v_category_totals->>'communication')::NUMERIC / (v_category_max->>'communication')::NUMERIC) * 100, 2)
      ELSE NULL 
    END
  );
  
  -- Calculate weighted final grade
  -- Only categories with grades contribute to the final grade
  -- Weights are normalized so they sum to 100% of graded categories
  
  -- Count categories with grades and sum their course weights
  IF (v_category_percentages->>'ku') IS NOT NULL THEN
    v_total_weight := v_total_weight + COALESCE((v_course_weights->>'ku')::NUMERIC, 0);
    v_categories_with_grades := v_categories_with_grades + 1;
  END IF;
  IF (v_category_percentages->>'thinking') IS NOT NULL THEN
    v_total_weight := v_total_weight + COALESCE((v_course_weights->>'thinking')::NUMERIC, 0);
    v_categories_with_grades := v_categories_with_grades + 1;
  END IF;
  IF (v_category_percentages->>'application') IS NOT NULL THEN
    v_total_weight := v_total_weight + COALESCE((v_course_weights->>'application')::NUMERIC, 0);
    v_categories_with_grades := v_categories_with_grades + 1;
  END IF;
  IF (v_category_percentages->>'communication') IS NOT NULL THEN
    v_total_weight := v_total_weight + COALESCE((v_course_weights->>'communication')::NUMERIC, 0);
    v_categories_with_grades := v_categories_with_grades + 1;
  END IF;
  
  -- If no categories have grades (shouldn't happen if v_has_any_grades is true)
  IF v_total_weight = 0 THEN
    v_final_grade := NULL;
  ELSE
    -- Calculate weighted sum with normalization
    -- Formula: sum(category_percentage * course_weight) / total_weight_of_graded_categories * 100
    IF (v_category_percentages->>'ku') IS NOT NULL THEN
      v_weighted_sum := v_weighted_sum + ((v_category_percentages->>'ku')::NUMERIC * (v_course_weights->>'ku')::NUMERIC / 100);
    END IF;
    IF (v_category_percentages->>'thinking') IS NOT NULL THEN
      v_weighted_sum := v_weighted_sum + ((v_category_percentages->>'thinking')::NUMERIC * (v_course_weights->>'thinking')::NUMERIC / 100);
    END IF;
    IF (v_category_percentages->>'application') IS NOT NULL THEN
      v_weighted_sum := v_weighted_sum + ((v_category_percentages->>'application')::NUMERIC * (v_course_weights->>'application')::NUMERIC / 100);
    END IF;
    IF (v_category_percentages->>'communication') IS NOT NULL THEN
      v_weighted_sum := v_weighted_sum + ((v_category_percentages->>'communication')::NUMERIC * (v_course_weights->>'communication')::NUMERIC / 100);
    END IF;
    
    -- Normalize by total weight of graded categories
    -- This ensures if only some categories have grades, the final grade is based on those
    v_final_grade := ROUND((v_weighted_sum / v_total_weight) * 100, 2);
  END IF;
  
  -- Build result
  v_result := jsonb_build_object(
    'final_grade', v_final_grade,
    'categories', v_category_percentages,
    'has_grades', v_has_any_grades,
    'graded_categories_count', v_categories_with_grades
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENT FOR DOCUMENTATION
-- ============================================
COMMENT ON FUNCTION calculate_student_grade(UUID, UUID) IS 
'Calculates a student''s grade for a course using the Ontario curriculum formula.

Parameters:
  p_student_id - The student''s profile ID
  p_course_id - The course ID

Returns JSONB with:
  - final_grade: The weighted final grade (0-100) or NULL if no grades
  - categories: Object with percentage for each category (ku, thinking, application, communication)
  - has_grades: Boolean indicating if any OF Learning grades exist
  - graded_categories_count: Number of categories that have grades

Edge Cases:
  - No grades: Returns NULL final_grade and NULL categories
  - No OF Learning assignments: Same as no grades
  - Missing categories: Only graded categories contribute, weights are normalized
  - Empty course: Returns NULL for everything

Example calculation:
  Course weights: K&U 80%, Application 20%
  Student scores: K&U 3/6 (50%), Application 6/6 (100%)
  Final grade: (50% × 80/100) + (100% × 20/100) = 40 + 20 = 60%
';

-- ============================================
-- UPDATE TRIGGER FUNCTION FOR BETTER HANDLING
-- ============================================
CREATE OR REPLACE FUNCTION trigger_recalculate_grade()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_student_id UUID;
  v_calculated JSONB;
  v_assignment_type TEXT;
  v_evaluation_type TEXT;
BEGIN
  -- Determine student_id and course_id from the grade record
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    SELECT m.course_id, ct.type, ct.evaluation_type 
    INTO v_course_id, v_assignment_type, v_evaluation_type
    FROM content ct
    JOIN modules m ON ct.module_id = m.id
    WHERE ct.id = OLD.assignment_id;
  ELSE
    v_student_id := NEW.student_id;
    SELECT m.course_id, ct.type, ct.evaluation_type 
    INTO v_course_id, v_assignment_type, v_evaluation_type
    FROM content ct
    JOIN modules m ON ct.module_id = m.id
    WHERE ct.id = NEW.assignment_id;
  END IF;
  
  -- Only recalculate if this is an OF Learning assignment
  -- FOR and AS Learning don't affect final grades
  IF v_course_id IS NOT NULL AND v_evaluation_type = 'of' THEN
    -- Recalculate grade
    v_calculated := calculate_student_grade(v_student_id, v_course_id);
    
    -- Update enrollments table with calculated grade
    UPDATE enrollments
    SET calculated_grade = v_calculated,
        last_calculated_at = NOW()
    WHERE student_id = v_student_id AND course_id = v_course_id;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION TO RECALCULATE ALL GRADES FOR A COURSE
-- ============================================
-- Useful for manual recalculation if needed
CREATE OR REPLACE FUNCTION recalculate_all_course_grades(p_course_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_enrollment RECORD;
  v_calculated JSONB;
BEGIN
  FOR v_enrollment IN
    SELECT student_id FROM enrollments WHERE course_id = p_course_id
  LOOP
    v_calculated := calculate_student_grade(v_enrollment.student_id, p_course_id);
    
    UPDATE enrollments
    SET calculated_grade = v_calculated,
        last_calculated_at = NOW()
    WHERE student_id = v_enrollment.student_id AND course_id = p_course_id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_all_course_grades(UUID) IS 
'Recalculates grades for all students enrolled in a course. Returns the number of students updated.';

-- ============================================
-- INDEX FOR FASTER GRADE QUERIES
-- ============================================
-- Index on content evaluation_type for filtering OF Learning assignments
CREATE INDEX IF NOT EXISTS idx_content_evaluation_type ON content(evaluation_type) WHERE evaluation_type = 'of';

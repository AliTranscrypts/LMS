-- LMS Database Schema
-- Version 1.0 - Initial setup with all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- Extends Supabase Auth with user profile data
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  full_name TEXT NOT NULL,
  student_id TEXT UNIQUE, -- UUID format: STU-xxxxxxxx-xxxx (only for students)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to generate student ID
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TEXT AS $$
DECLARE
  uuid_part TEXT;
BEGIN
  uuid_part := gen_random_uuid()::TEXT;
  RETURN 'STU-' || SUBSTRING(uuid_part FROM 1 FOR 8) || '-' || SUBSTRING(uuid_part FROM 10 FOR 4);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate student_id on profile creation for students
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.student_id IS NULL THEN
    NEW.student_id := generate_student_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_created
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_profile();

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES profiles(id),
  name TEXT NOT NULL,
  description TEXT,
  syllabus JSONB, -- Quill delta format for rich text
  category_weights JSONB NOT NULL DEFAULT '{"ku": 25, "thinking": 25, "application": 25, "communication": 25}',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MODULES TABLE
-- ============================================
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTENT TABLE (Polymorphic: reading, video, assignment, quiz)
-- ============================================
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('reading', 'video', 'assignment', 'quiz')),
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  
  -- File references (for reading/video)
  file_url TEXT,
  file_size BIGINT,
  file_type TEXT,
  
  -- Assignment-specific fields
  submission_type TEXT CHECK (submission_type IN ('file', 'text', 'both')),
  category_weights JSONB, -- {ku: 40, thinking: 30, application: 20, communication: 10}
  evaluation_type TEXT CHECK (evaluation_type IN ('for', 'as', 'of')),
  due_date TIMESTAMPTZ,
  total_points INTEGER,
  
  -- Quiz-specific fields
  quiz_config JSONB, -- {time_limit: 60, questions: [...]}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ENROLLMENTS TABLE
-- ============================================
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Cached grade calculations (updated by trigger)
  calculated_grade JSONB, -- {final_grade: 85, categories: {ku: 88, thinking: 82, application: 86, communication: 84}}
  last_calculated_at TIMESTAMPTZ,
  
  UNIQUE(course_id, student_id)
);

-- ============================================
-- CONTENT PROGRESS TABLE
-- ============================================
CREATE TABLE content_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE(content_id, student_id)
);

-- ============================================
-- SUBMISSIONS TABLE
-- ============================================
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_data JSONB NOT NULL, -- {type: 'file'|'text', content: '...', file_url: '...'}
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  is_late BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1
);

-- ============================================
-- GRADES TABLE
-- ============================================
CREATE TABLE grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id),
  category_scores JSONB NOT NULL, -- {ku: 35, thinking: 25, application: 17, communication: 8}
  total_score NUMERIC NOT NULL,
  max_score INTEGER NOT NULL,
  feedback TEXT,
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  graded_by UUID REFERENCES profiles(id),
  UNIQUE(assignment_id, student_id)
);

-- ============================================
-- QUIZ ATTEMPTS TABLE
-- ============================================
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL, -- {question_id: answer, ...}
  category_scores JSONB,
  total_score NUMERIC,
  max_score INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  is_graded BOOLEAN DEFAULT FALSE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_courses_teacher ON courses(teacher_id);
CREATE INDEX idx_modules_course ON modules(course_id);
CREATE INDEX idx_content_module ON content(module_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_grades_assignment ON grades(assignment_id);
CREATE INDEX idx_grades_student ON grades(student_id);
CREATE INDEX idx_progress_student ON content_progress(student_id);
CREATE INDEX idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE UNIQUE INDEX idx_profiles_student_id ON profiles(student_id) WHERE student_id IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Profiles: Users can view all (for names), update only their own
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Courses: Teachers CRUD their own, students SELECT enrolled courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their courses"
  ON courses FOR ALL
  USING (auth.uid() = teacher_id);

CREATE POLICY "Students can view enrolled courses"
  ON courses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE course_id = courses.id AND student_id = auth.uid()
    )
  );

-- Modules: Follow course access
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage modules in their courses"
  ON modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE id = modules.course_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view modules in enrolled courses"
  ON modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      WHERE c.id = modules.course_id AND e.student_id = auth.uid()
    )
  );

-- Content: Follow module/course access
ALTER TABLE content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage content in their courses"
  ON content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = content.module_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view content in enrolled courses"
  ON content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN enrollments e ON e.course_id = m.course_id
      WHERE m.id = content.module_id AND e.student_id = auth.uid()
    )
  );

-- Enrollments: Teachers can manage, students can view enrollments in their courses
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage enrollments for their courses"
  ON enrollments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE id = enrollments.course_id AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can view enrollments in their courses (for roster)"
  ON enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM enrollments e2
      WHERE e2.course_id = enrollments.course_id AND e2.student_id = auth.uid()
    )
  );

-- Content Progress: Students can manage their own progress
ALTER TABLE content_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own progress"
  ON content_progress FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view progress in their courses"
  ON content_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content ct
      JOIN modules m ON m.id = ct.module_id
      JOIN courses c ON c.id = m.course_id
      WHERE ct.id = content_progress.content_id AND c.teacher_id = auth.uid()
    )
  );

-- Submissions: Students manage their own, teachers view
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own submissions"
  ON submissions FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions for their courses"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content c
      JOIN modules m ON c.module_id = m.id
      JOIN courses co ON m.course_id = co.id
      WHERE c.id = submissions.assignment_id AND co.teacher_id = auth.uid()
    )
  );

-- Grades: Teachers can manage, students can view only their own
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage grades for their courses"
  ON grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM content c
      JOIN modules m ON c.module_id = m.id
      JOIN courses co ON m.course_id = co.id
      WHERE c.id = grades.assignment_id AND co.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own grades"
  ON grades FOR SELECT
  USING (student_id = auth.uid());

-- Quiz Attempts: Students manage their own, teachers view
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage their own quiz attempts"
  ON quiz_attempts FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can view quiz attempts for their courses"
  ON quiz_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM content c
      JOIN modules m ON c.module_id = m.id
      JOIN courses co ON m.course_id = co.id
      WHERE c.id = quiz_attempts.quiz_id AND co.teacher_id = auth.uid()
    )
  );

-- ============================================
-- GRADING FUNCTION AND TRIGGER
-- ============================================

-- Function to calculate student grade for a course
CREATE OR REPLACE FUNCTION calculate_student_grade(p_student_id UUID, p_course_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_course_weights JSONB;
  v_result JSONB;
  v_category_totals JSONB;
  v_category_max JSONB;
  v_category_percentages JSONB;
  v_final_grade NUMERIC;
BEGIN
  -- Get course category weights
  SELECT category_weights INTO v_course_weights
  FROM courses WHERE id = p_course_id;
  
  IF v_course_weights IS NULL THEN
    RETURN '{"final_grade": null, "categories": {}}'::JSONB;
  END IF;
  
  -- Calculate category totals from OF Learning assignments only
  SELECT 
    COALESCE(jsonb_build_object(
      'ku', SUM((g.category_scores->>'ku')::NUMERIC),
      'thinking', SUM((g.category_scores->>'thinking')::NUMERIC),
      'application', SUM((g.category_scores->>'application')::NUMERIC),
      'communication', SUM((g.category_scores->>'communication')::NUMERIC)
    ), '{}'::JSONB),
    COALESCE(jsonb_build_object(
      'ku', SUM(COALESCE((ct.category_weights->>'ku')::NUMERIC, 0)),
      'thinking', SUM(COALESCE((ct.category_weights->>'thinking')::NUMERIC, 0)),
      'application', SUM(COALESCE((ct.category_weights->>'application')::NUMERIC, 0)),
      'communication', SUM(COALESCE((ct.category_weights->>'communication')::NUMERIC, 0))
    ), '{}'::JSONB)
  INTO v_category_totals, v_category_max
  FROM grades g
  JOIN content ct ON ct.id = g.assignment_id
  JOIN modules m ON m.id = ct.module_id
  WHERE g.student_id = p_student_id
    AND m.course_id = p_course_id
    AND ct.evaluation_type = 'of';
  
  -- Calculate percentage for each category
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
  v_final_grade := 0;
  IF (v_category_percentages->>'ku') IS NOT NULL THEN
    v_final_grade := v_final_grade + ((v_category_percentages->>'ku')::NUMERIC * (v_course_weights->>'ku')::NUMERIC / 100);
  END IF;
  IF (v_category_percentages->>'thinking') IS NOT NULL THEN
    v_final_grade := v_final_grade + ((v_category_percentages->>'thinking')::NUMERIC * (v_course_weights->>'thinking')::NUMERIC / 100);
  END IF;
  IF (v_category_percentages->>'application') IS NOT NULL THEN
    v_final_grade := v_final_grade + ((v_category_percentages->>'application')::NUMERIC * (v_course_weights->>'application')::NUMERIC / 100);
  END IF;
  IF (v_category_percentages->>'communication') IS NOT NULL THEN
    v_final_grade := v_final_grade + ((v_category_percentages->>'communication')::NUMERIC * (v_course_weights->>'communication')::NUMERIC / 100);
  END IF;
  
  v_result := jsonb_build_object(
    'final_grade', ROUND(v_final_grade, 2),
    'categories', v_category_percentages
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to recalculate grade when grades change
CREATE OR REPLACE FUNCTION trigger_recalculate_grade()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_student_id UUID;
  v_calculated JSONB;
BEGIN
  -- Determine student_id and course_id from the grade record
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    SELECT m.course_id INTO v_course_id
    FROM content c
    JOIN modules m ON c.module_id = m.id
    WHERE c.id = OLD.assignment_id;
  ELSE
    v_student_id := NEW.student_id;
    SELECT m.course_id INTO v_course_id
    FROM content c
    JOIN modules m ON c.module_id = m.id
    WHERE c.id = NEW.assignment_id;
  END IF;
  
  IF v_course_id IS NOT NULL THEN
    -- Recalculate grade
    v_calculated := calculate_student_grade(v_student_id, v_course_id);
    
    -- Update enrollments table
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

CREATE TRIGGER grades_changed
AFTER INSERT OR UPDATE OR DELETE ON grades
FOR EACH ROW
EXECUTE FUNCTION trigger_recalculate_grade();

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Complete RLS fix using SECURITY DEFINER functions with user ID as parameter
-- This avoids auth context issues inside SECURITY DEFINER functions

-- ============================================
-- DROP ALL EXISTING POLICIES FIRST
-- ============================================

DO $$ 
DECLARE
  pol RECORD;
BEGIN
  -- Drop all policies on our tables
  FOR pol IN 
    SELECT policyname, tablename 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('courses', 'enrollments', 'modules', 'content', 
                      'content_progress', 'submissions', 'grades', 'quiz_attempts')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================
-- DROP OLD HELPER FUNCTIONS
-- ============================================

DROP FUNCTION IF EXISTS is_course_teacher(UUID);
DROP FUNCTION IF EXISTS is_enrolled_in_course(UUID);
DROP FUNCTION IF EXISTS get_course_id_from_module(UUID);
DROP FUNCTION IF EXISTS get_course_id_from_content(UUID);
DROP FUNCTION IF EXISTS can_manage_content_in_module(UUID);

-- ============================================
-- CREATE HELPER FUNCTIONS WITH USER ID PARAMETER
-- These bypass RLS and don't rely on auth context
-- ============================================

-- Check if a user is the teacher of a course
CREATE OR REPLACE FUNCTION check_is_teacher(p_user_id UUID, p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id AND teacher_id = p_user_id
  );
END;
$$;

-- Check if a user is enrolled in a course
CREATE OR REPLACE FUNCTION check_is_enrolled(p_user_id UUID, p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM enrollments
    WHERE course_id = p_course_id AND student_id = p_user_id
  );
END;
$$;

-- Get course_id from module_id (no RLS)
CREATE OR REPLACE FUNCTION get_module_course_id(p_module_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT course_id INTO v_course_id FROM modules WHERE id = p_module_id;
  RETURN v_course_id;
END;
$$;

-- Get course_id from content_id (no RLS)
CREATE OR REPLACE FUNCTION get_content_course_id(p_content_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT m.course_id INTO v_course_id
  FROM content c
  JOIN modules m ON m.id = c.module_id
  WHERE c.id = p_content_id;
  RETURN v_course_id;
END;
$$;

-- CRITICAL: Set function owner to postgres (which has BYPASSRLS)
-- This is required for SECURITY DEFINER to actually bypass RLS
ALTER FUNCTION check_is_teacher(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION check_is_enrolled(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION get_module_course_id(UUID) OWNER TO postgres;
ALTER FUNCTION get_content_course_id(UUID) OWNER TO postgres;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION check_is_teacher(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_is_enrolled(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_module_course_id(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_content_course_id(UUID) TO authenticated, anon;

-- ============================================
-- COURSES POLICIES
-- ============================================

-- Teachers can do everything with their own courses
CREATE POLICY "courses_teacher_all"
  ON courses FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Students can view courses they're enrolled in
CREATE POLICY "courses_student_select"
  ON courses FOR SELECT
  TO authenticated
  USING (check_is_enrolled(auth.uid(), id));

-- ============================================
-- ENROLLMENTS POLICIES
-- ============================================

-- Teachers can manage enrollments in their courses
CREATE POLICY "enrollments_teacher_all"
  ON enrollments FOR ALL
  TO authenticated
  USING (check_is_teacher(auth.uid(), course_id))
  WITH CHECK (check_is_teacher(auth.uid(), course_id));

-- Students can view their own enrollments
CREATE POLICY "enrollments_student_select"
  ON enrollments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- ============================================
-- MODULES POLICIES
-- ============================================

-- Teachers can manage modules in their courses
CREATE POLICY "modules_teacher_all"
  ON modules FOR ALL
  TO authenticated
  USING (check_is_teacher(auth.uid(), course_id))
  WITH CHECK (check_is_teacher(auth.uid(), course_id));

-- Students can view modules in courses they're enrolled in
CREATE POLICY "modules_student_select"
  ON modules FOR SELECT
  TO authenticated
  USING (check_is_enrolled(auth.uid(), course_id));

-- ============================================
-- CONTENT POLICIES
-- ============================================

-- Teachers can manage content in their courses
CREATE POLICY "content_teacher_all"
  ON content FOR ALL
  TO authenticated
  USING (check_is_teacher(auth.uid(), get_module_course_id(module_id)))
  WITH CHECK (check_is_teacher(auth.uid(), get_module_course_id(module_id)));

-- Students can view content in courses they're enrolled in
CREATE POLICY "content_student_select"
  ON content FOR SELECT
  TO authenticated
  USING (check_is_enrolled(auth.uid(), get_module_course_id(module_id)));

-- ============================================
-- CONTENT PROGRESS POLICIES
-- ============================================

-- Students can manage their own progress
CREATE POLICY "progress_student_all"
  ON content_progress FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can view progress in their courses
CREATE POLICY "progress_teacher_select"
  ON content_progress FOR SELECT
  TO authenticated
  USING (check_is_teacher(auth.uid(), get_content_course_id(content_id)));

-- ============================================
-- SUBMISSIONS POLICIES
-- ============================================

-- Students can manage their own submissions
CREATE POLICY "submissions_student_all"
  ON submissions FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can view submissions in their courses
CREATE POLICY "submissions_teacher_select"
  ON submissions FOR SELECT
  TO authenticated
  USING (check_is_teacher(auth.uid(), get_content_course_id(assignment_id)));

-- ============================================
-- GRADES POLICIES
-- ============================================

-- Teachers can manage grades in their courses
CREATE POLICY "grades_teacher_all"
  ON grades FOR ALL
  TO authenticated
  USING (check_is_teacher(auth.uid(), get_content_course_id(assignment_id)))
  WITH CHECK (check_is_teacher(auth.uid(), get_content_course_id(assignment_id)));

-- Students can view their own grades
CREATE POLICY "grades_student_select"
  ON grades FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- ============================================
-- QUIZ ATTEMPTS POLICIES
-- ============================================

-- Students can manage their own quiz attempts
CREATE POLICY "quiz_attempts_student_all"
  ON quiz_attempts FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Teachers can view quiz attempts in their courses
CREATE POLICY "quiz_attempts_teacher_select"
  ON quiz_attempts FOR SELECT
  TO authenticated
  USING (check_is_teacher(auth.uid(), get_content_course_id(quiz_id)));

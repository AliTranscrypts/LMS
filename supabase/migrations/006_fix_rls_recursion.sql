-- Fix RLS infinite recursion between courses and enrollments tables
-- The issue: courses policy checks enrollments, enrollments policy checks courses

-- ============================================
-- HELPER FUNCTIONS (SECURITY DEFINER bypasses RLS)
-- ============================================

-- Check if user is the teacher of a course (bypasses RLS)
CREATE OR REPLACE FUNCTION is_course_teacher(p_course_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM courses
    WHERE id = p_course_id AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is enrolled in a course (bypasses RLS)
CREATE OR REPLACE FUNCTION is_enrolled_in_course(p_course_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM enrollments
    WHERE course_id = p_course_id AND student_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get course_id from a module_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_course_id_from_module(p_module_id UUID)
RETURNS UUID AS $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT course_id INTO v_course_id FROM modules WHERE id = p_module_id;
  RETURN v_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get course_id from content_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_course_id_from_content(p_content_id UUID)
RETURNS UUID AS $$
DECLARE
  v_course_id UUID;
BEGIN
  SELECT m.course_id INTO v_course_id 
  FROM content c
  JOIN modules m ON m.id = c.module_id
  WHERE c.id = p_content_id;
  RETURN v_course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- DROP EXISTING PROBLEMATIC POLICIES
-- ============================================

-- Courses policies
DROP POLICY IF EXISTS "Teachers can manage their courses" ON courses;
DROP POLICY IF EXISTS "Students can view enrolled courses" ON courses;

-- Enrollments policies
DROP POLICY IF EXISTS "Teachers can manage enrollments for their courses" ON enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON enrollments;
DROP POLICY IF EXISTS "Students can view enrollments in their courses (for roster)" ON enrollments;

-- Modules policies
DROP POLICY IF EXISTS "Teachers can manage modules in their courses" ON modules;
DROP POLICY IF EXISTS "Students can view modules in enrolled courses" ON modules;

-- Content policies
DROP POLICY IF EXISTS "Teachers can manage content in their courses" ON content;
DROP POLICY IF EXISTS "Students can view content in enrolled courses" ON content;

-- Content Progress policies
DROP POLICY IF EXISTS "Students can manage their own progress" ON content_progress;
DROP POLICY IF EXISTS "Teachers can view progress in their courses" ON content_progress;

-- Submissions policies
DROP POLICY IF EXISTS "Students can manage their own submissions" ON submissions;
DROP POLICY IF EXISTS "Teachers can view submissions for their courses" ON submissions;

-- Grades policies
DROP POLICY IF EXISTS "Teachers can manage grades for their courses" ON grades;
DROP POLICY IF EXISTS "Students can view their own grades" ON grades;

-- Quiz attempts policies
DROP POLICY IF EXISTS "Students can manage their own quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Teachers can view quiz attempts for their courses" ON quiz_attempts;

-- ============================================
-- RECREATE POLICIES USING HELPER FUNCTIONS
-- ============================================

-- COURSES: Simple policies without cross-table RLS checks
CREATE POLICY "Teachers can manage their courses"
  ON courses FOR ALL
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Students can view enrolled courses"
  ON courses FOR SELECT
  USING (is_enrolled_in_course(id));

-- ENROLLMENTS: Use helper function to avoid recursion
CREATE POLICY "Teachers can manage enrollments for their courses"
  ON enrollments FOR ALL
  USING (is_course_teacher(course_id))
  WITH CHECK (is_course_teacher(course_id));

CREATE POLICY "Students can view their own enrollments"
  ON enrollments FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can view classmates in enrolled courses"
  ON enrollments FOR SELECT
  USING (is_enrolled_in_course(course_id));

-- MODULES: Use helper functions
CREATE POLICY "Teachers can manage modules in their courses"
  ON modules FOR ALL
  USING (is_course_teacher(course_id))
  WITH CHECK (is_course_teacher(course_id));

CREATE POLICY "Students can view modules in enrolled courses"
  ON modules FOR SELECT
  USING (is_enrolled_in_course(course_id));

-- CONTENT: Use helper functions
CREATE POLICY "Teachers can manage content in their courses"
  ON content FOR ALL
  USING (is_course_teacher(get_course_id_from_module(module_id)))
  WITH CHECK (is_course_teacher(get_course_id_from_module(module_id)));

CREATE POLICY "Students can view content in enrolled courses"
  ON content FOR SELECT
  USING (is_enrolled_in_course(get_course_id_from_module(module_id)));

-- CONTENT PROGRESS: Use helper functions
CREATE POLICY "Students can manage their own progress"
  ON content_progress FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view progress in their courses"
  ON content_progress FOR SELECT
  USING (is_course_teacher(get_course_id_from_content(content_id)));

-- SUBMISSIONS: Use helper functions
CREATE POLICY "Students can manage their own submissions"
  ON submissions FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view submissions for their courses"
  ON submissions FOR SELECT
  USING (is_course_teacher(get_course_id_from_content(assignment_id)));

-- GRADES: Use helper functions
CREATE POLICY "Teachers can manage grades for their courses"
  ON grades FOR ALL
  USING (is_course_teacher(get_course_id_from_content(assignment_id)))
  WITH CHECK (is_course_teacher(get_course_id_from_content(assignment_id)));

CREATE POLICY "Students can view their own grades"
  ON grades FOR SELECT
  USING (student_id = auth.uid());

-- QUIZ ATTEMPTS: Use helper functions
CREATE POLICY "Students can manage their own quiz attempts"
  ON quiz_attempts FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Teachers can view quiz attempts for their courses"
  ON quiz_attempts FOR SELECT
  USING (is_course_teacher(get_course_id_from_content(quiz_id)));

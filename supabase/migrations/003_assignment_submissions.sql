-- Assignment Submissions Migration
-- Version 3.0 - Storage policies for assignment submissions

-- ============================================
-- STORAGE BUCKET POLICIES FOR SUBMISSIONS
-- ============================================

-- Note: The 'course-content' bucket should already exist from 002_file_uploads.sql
-- This migration adds specific policies for the submissions folder

-- Policy: Students can upload their own submission files
CREATE POLICY "Students can upload submission files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'submissions' AND
  -- The path format is: submissions/{assignment_id}/{student_id}/{timestamp}.{ext}
  (storage.foldername(name))[3] = auth.uid()::text AND
  -- Verify student is enrolled in the course that owns this assignment
  EXISTS (
    SELECT 1 FROM content c
    JOIN modules m ON c.module_id = m.id
    JOIN enrollments e ON m.course_id = e.course_id
    WHERE c.id = ((storage.foldername(name))[2])::uuid
    AND e.student_id = auth.uid()
  )
);

-- Policy: Students can read their own submission files
CREATE POLICY "Students can read their own submission files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'submissions' AND
  (storage.foldername(name))[3] = auth.uid()::text
);

-- Policy: Teachers can read all submission files in their courses
CREATE POLICY "Teachers can read submission files in their courses"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'course-content' AND
  (storage.foldername(name))[1] = 'submissions' AND
  EXISTS (
    SELECT 1 FROM content c
    JOIN modules m ON c.module_id = m.id
    JOIN courses co ON m.course_id = co.id
    WHERE c.id = ((storage.foldername(name))[2])::uuid
    AND co.teacher_id = auth.uid()
  )
);

-- ============================================
-- INDEX FOR FASTER SUBMISSION QUERIES
-- ============================================

-- Index for finding latest submission per student per assignment
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_student_version 
ON submissions(assignment_id, student_id, version DESC);

-- Index for finding submissions by timestamp (for history queries)
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at 
ON submissions(submitted_at DESC);

-- ============================================
-- FUNCTION TO GET SUBMISSION STATISTICS
-- ============================================

-- Function to get submission stats for an assignment
CREATE OR REPLACE FUNCTION get_assignment_submission_stats(p_assignment_id UUID)
RETURNS TABLE (
  total_enrolled BIGINT,
  total_submitted BIGINT,
  total_graded BIGINT,
  late_submissions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH course_info AS (
    SELECT m.course_id
    FROM content c
    JOIN modules m ON c.module_id = m.id
    WHERE c.id = p_assignment_id
  ),
  enrolled AS (
    SELECT COUNT(DISTINCT e.student_id) as count
    FROM enrollments e
    JOIN course_info ci ON e.course_id = ci.course_id
  ),
  submitted AS (
    SELECT 
      COUNT(DISTINCT s.student_id) as count,
      COUNT(DISTINCT CASE WHEN s.is_late THEN s.student_id END) as late_count
    FROM submissions s
    WHERE s.assignment_id = p_assignment_id
  ),
  graded AS (
    SELECT COUNT(DISTINCT g.student_id) as count
    FROM grades g
    WHERE g.assignment_id = p_assignment_id
  )
  SELECT 
    enrolled.count,
    submitted.count,
    graded.count,
    submitted.late_count
  FROM enrolled, submitted, graded;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

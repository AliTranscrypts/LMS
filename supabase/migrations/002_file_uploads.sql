-- File Uploads Migration
-- Adds support for tracking incomplete uploads for cleanup

-- ============================================
-- INCOMPLETE UPLOADS TABLE
-- Tracks uploads that haven't completed for cleanup
-- ============================================
CREATE TABLE incomplete_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Storage path: /courses/{courseId}/content/{fileId}
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  upload_id TEXT, -- TUS upload ID for resumability
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding old incomplete uploads
CREATE INDEX idx_incomplete_uploads_created ON incomplete_uploads(created_at);
CREATE INDEX idx_incomplete_uploads_course ON incomplete_uploads(course_id);

-- Row Level Security for incomplete_uploads
ALTER TABLE incomplete_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage their incomplete uploads"
  ON incomplete_uploads FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE id = incomplete_uploads.course_id AND teacher_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTION TO CLEANUP OLD INCOMPLETE UPLOADS
-- Should be called by a scheduled job (e.g., Supabase Edge Function cron)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_incomplete_uploads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete incomplete uploads older than 24 hours
  WITH deleted AS (
    DELETE FROM incomplete_uploads
    WHERE created_at < NOW() - INTERVAL '24 hours'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STORAGE BUCKET SETUP (run in Supabase dashboard or CLI)
-- ============================================
-- Note: Run these commands in Supabase SQL editor or use the dashboard:
-- 
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('course-content', 'course-content', false);
-- 
-- CREATE POLICY "Teachers can upload to their course folders"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     bucket_id = 'course-content' AND
--     EXISTS (
--       SELECT 1 FROM courses
--       WHERE id = (storage.foldername(name))[2]::UUID
--       AND teacher_id = auth.uid()
--     )
--   );
-- 
-- CREATE POLICY "Teachers can update their course files"
--   ON storage.objects FOR UPDATE
--   TO authenticated
--   USING (
--     bucket_id = 'course-content' AND
--     EXISTS (
--       SELECT 1 FROM courses
--       WHERE id = (storage.foldername(name))[2]::UUID
--       AND teacher_id = auth.uid()
--     )
--   );
-- 
-- CREATE POLICY "Teachers can delete their course files"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (
--     bucket_id = 'course-content' AND
--     EXISTS (
--       SELECT 1 FROM courses
--       WHERE id = (storage.foldername(name))[2]::UUID
--       AND teacher_id = auth.uid()
--     )
--   );
-- 
-- CREATE POLICY "Enrolled students and teachers can view course files"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (
--     bucket_id = 'course-content' AND
--     (
--       EXISTS (
--         SELECT 1 FROM courses
--         WHERE id = (storage.foldername(name))[2]::UUID
--         AND teacher_id = auth.uid()
--       )
--       OR
--       EXISTS (
--         SELECT 1 FROM enrollments
--         WHERE course_id = (storage.foldername(name))[2]::UUID
--         AND student_id = auth.uid()
--       )
--     )
--   );

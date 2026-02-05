-- Migration: Add attachment fields to content table for assignments
-- This allows teachers to attach documents or videos to assignments
-- that students should read/watch before completing the assignment

-- Add attachment columns to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS attachment_type TEXT CHECK (attachment_type IN ('assignment_document', 'assignment_video')),
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_file_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_file_size BIGINT,
ADD COLUMN IF NOT EXISTS attachment_file_type TEXT;

-- Add comment for documentation
COMMENT ON COLUMN content.attachment_type IS 'Type of attachment: assignment_document (PDF, Word, etc.) or assignment_video (MP4, etc.)';
COMMENT ON COLUMN content.attachment_url IS 'Storage path for the attachment file';
COMMENT ON COLUMN content.attachment_file_name IS 'Original file name of the attachment';
COMMENT ON COLUMN content.attachment_file_size IS 'Size of the attachment in bytes';
COMMENT ON COLUMN content.attachment_file_type IS 'MIME type of the attachment';

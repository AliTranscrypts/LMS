-- ============================================
-- Migration: Add Text Content Type
-- ============================================
-- Adds a new 'text' content type for rich text content
-- that allows teachers to add formatted text, links, 
-- images, and other rich content to modules.

-- Add text_content column for storing rich text (Quill delta format)
ALTER TABLE content
ADD COLUMN IF NOT EXISTS text_content JSONB;

-- Update the content type check constraint to include 'text'
-- First drop the existing constraint, then add the new one
ALTER TABLE content 
DROP CONSTRAINT IF EXISTS content_type_check;

ALTER TABLE content
ADD CONSTRAINT content_type_check 
CHECK (type IN ('reading', 'video', 'text', 'assignment', 'quiz'));

-- Add comment for documentation
COMMENT ON COLUMN content.text_content IS 'Rich text content stored as Quill delta format (JSONB). Used when type = text.';

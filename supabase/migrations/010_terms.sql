-- Terms Feature Migration
-- Adds terms table for organizing student enrollments by academic period

-- ============================================
-- TERMS TABLE
-- ============================================
CREATE TABLE terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ADD TERM_ID TO ENROLLMENTS
-- ============================================
ALTER TABLE enrollments 
ADD COLUMN term_id UUID REFERENCES terms(id) ON DELETE SET NULL;

-- ============================================
-- UPDATE UNIQUE CONSTRAINT
-- Allow same student in same course for different terms
-- ============================================
-- Drop the old constraint
ALTER TABLE enrollments DROP CONSTRAINT enrollments_course_id_student_id_key;

-- Add new constraint using COALESCE to handle NULL term_id
-- This allows a student to be enrolled in:
-- - Different terms of the same course
-- - Only once per term (or once with NULL term)
CREATE UNIQUE INDEX enrollments_course_student_term_unique 
ON enrollments (course_id, student_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ============================================
-- INDEX FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_enrollments_term ON enrollments(term_id);

-- ============================================
-- ROW LEVEL SECURITY FOR TERMS
-- ============================================
ALTER TABLE terms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view terms
CREATE POLICY "Authenticated users can view terms"
ON terms FOR SELECT
TO authenticated
USING (true);

-- Teachers can create terms
CREATE POLICY "Teachers can create terms"
ON terms FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Teachers can update terms
CREATE POLICY "Teachers can update terms"
ON terms FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Teachers can delete terms (only if they created it or are a teacher)
CREATE POLICY "Teachers can delete terms"
ON terms FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

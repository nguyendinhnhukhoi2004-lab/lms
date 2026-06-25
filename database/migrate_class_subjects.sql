-- database/migrate_class_subjects.sql
BEGIN;

-- 1. Drop existing tables that are no longer needed
DROP TABLE IF EXISTS student_module_classes CASCADE;
DROP TABLE IF EXISTS module_classes CASCADE;
DROP TABLE IF EXISTS student_subjects CASCADE;

-- 2. Create class_subjects table
CREATE TABLE IF NOT EXISTS class_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(class_id, subject_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_class_subjects_class ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_class_subjects_teacher ON class_subjects(teacher_id);

COMMIT;

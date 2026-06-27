ALTER TABLE submission_answers ADD COLUMN IF NOT EXISTS nlp_detail jsonb DEFAULT NULL;

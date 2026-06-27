ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS updated_at timestamp;

-- Index cho submission_answers — tăng tốc chấm điểm, thống kê, autoSubmit job
CREATE INDEX IF NOT EXISTS idx_sub_answers_submission
  ON public.submission_answers(submission_id);

CREATE INDEX IF NOT EXISTS idx_sub_answers_question
  ON public.submission_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_sub_answers_pending_essay
  ON public.submission_answers(submission_id)
  WHERE final_score IS NULL;

-- Index cho results — tăng tốc getStudentProgress và getScheduleSummary
CREATE INDEX IF NOT EXISTS idx_results_student_graded
  ON public.results(student_id, graded_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_exam_id
  ON public.results(exam_id);

-- Index cho submissions — tăng tốc autoSubmit job quét bài in_progress
CREATE INDEX IF NOT EXISTS idx_submissions_status_schedule
  ON public.submissions(status, schedule_id)
  WHERE status = 'in_progress';

-- Phân biệt câu hỏi tạo thủ công và câu hỏi từ file import đề thi
-- manual: tạo thủ công → hiện trong ngân hàng, cần duyệt
-- import: từ file import → không hiện trong ngân hàng, không cần duyệt
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source varchar(20) DEFAULT 'manual';

-- Đánh dấu các câu hiện có là manual
UPDATE public.questions SET source = 'manual' WHERE source IS NULL;

-- Index để lọc nhanh theo source
CREATE INDEX IF NOT EXISTS idx_questions_source
  ON public.questions(source);

-- =============================================================================
-- SCHEMA HỆ THỐNG QUẢN LÝ ĐỀ THI & ĐÁNH GIÁ TỰ ĐỘNG THPT
-- Phiên bản: 2.0  |  Cập nhật: 2026-06
-- Chương trình GDPT 2018 - 36 lớp (10T1..12X5)
-- =============================================================================

-- Bật extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

-- Vai trò người dùng
CREATE TYPE public.user_role AS ENUM (
    'admin',            -- Quản trị viên
    'department_head',  -- Tổ trưởng bộ môn (đồng thời giảng dạy)
    'teacher',          -- Giáo viên
    'student'           -- Học sinh
);

-- Mức độ nhận thức (Công văn 7991/BGDĐT-GDTrH ngày 17/12/2024)
CREATE TYPE public.difficulty_level AS ENUM (
    'nhan_biet',     -- Biết
    'thong_hieu',    -- Hiểu
    'van_dung'       -- Vận dụng
);

-- Loại câu hỏi
CREATE TYPE public.question_type AS ENUM (
    'multiple_choice', -- Trắc nghiệm nhiều lựa chọn
    'true_false',      -- Đúng / Sai
    'short_answer',    -- Trả lời ngắn
    'essay'            -- Tự luận
);

-- Trạng thái đề thi
CREATE TYPE public.exam_status AS ENUM (
    'draft',            -- Bản nháp (giáo viên đang soạn)
    'pending_approval', -- Đã nộp, chờ tổ trưởng duyệt
    'approved',         -- Đã được duyệt
    'archived'          -- Lưu trữ
);

-- Trạng thái bài làm
CREATE TYPE public.submission_status AS ENUM (
    'in_progress', -- Đang làm bài
    'submitted',   -- Đã nộp
    'graded'       -- Đã chấm xong
);

-- Phân loại môn học
CREATE TYPE public.subject_category AS ENUM (
    'bat_buoc',     -- Môn bắt buộc (Toán, Văn, Anh, Lịch sử)
    'khtn',         -- Khoa học tự nhiên (Lý, Hóa, Sinh)
    'khxh',         -- Khoa học xã hội (Địa, GDKTPL)
    'cong_nghe_nt', -- Công nghệ nông nghiệp
    'chuyen_de',    -- Chuyên đề nâng cao
    'tu_chon'       -- Tự chọn (Tin học)
);

-- =============================================================================
-- HÀM & TRIGGER
-- =============================================================================

-- Tự động xóa lý do từ chối khi giáo viên tái nộp đề
CREATE OR REPLACE FUNCTION public.clear_rejection_on_submit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'pending_approval' AND OLD.status = 'draft' THEN
    NEW.rejection_reason := NULL;
    NEW.rejected_at      := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- BẢNG DỮ LIỆU CHÍNH
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users: Tài khoản người dùng
-- role = 'department_head' vừa là tổ trưởng vừa có thể giảng dạy lớp
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
    id            uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    full_name     varchar(100)  NOT NULL,
    email         varchar(150)  NOT NULL,
    password_hash varchar(255)  NOT NULL,
    role          public.user_role NOT NULL,
    class_id      uuid,                          -- Chỉ học sinh mới có class_id
    is_active     boolean DEFAULT true,
    created_at    timestamp DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);

-- -----------------------------------------------------------------------------
-- classes: Lớp học (36 lớp: 10T1..10T7, 10X1..10X5, tương tự cho 11 và 12)
-- T = định hướng Khoa học Tự nhiên, X = định hướng Khoa học Xã hội
-- -----------------------------------------------------------------------------
CREATE TABLE public.classes (
    id                   uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    name                 varchar(20)  NOT NULL,   -- Ví dụ: 10T1, 11X3
    grade                smallint     NOT NULL,   -- 10, 11, hoặc 12
    school_year          varchar(10)  NOT NULL,   -- Ví dụ: 2024-2025
    homeroom_teacher_id  uuid,
    created_at           timestamp DEFAULT now(),
    CONSTRAINT classes_pkey PRIMARY KEY (id),
    CONSTRAINT classes_grade_check CHECK (grade >= 10 AND grade <= 12)
);

-- -----------------------------------------------------------------------------
-- subjects: Môn học theo khối lớp
-- Ví dụ: "Toán 10", "Vật lý 11", "Tin học 12"
-- -----------------------------------------------------------------------------
CREATE TABLE public.subjects (
    id          uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    name        varchar(100) NOT NULL,
    grade       smallint     NOT NULL,   -- 10, 11, hoặc 12
    category    public.subject_category DEFAULT 'bat_buoc' NOT NULL,
    description text,
    created_at  timestamp DEFAULT now(),
    CONSTRAINT subjects_pkey PRIMARY KEY (id),
    CONSTRAINT subjects_grade_check CHECK (grade >= 10 AND grade <= 12)
);

-- -----------------------------------------------------------------------------
-- class_subjects: Phân công giáo viên dạy từng môn của từng lớp
-- Mỗi cặp (class_id, subject_id) chỉ có một giáo viên phụ trách
-- Giáo viên mỗi người chỉ dạy 1 khối và các lớp liền kề nhau
-- Tổ trưởng (department_head) cũng được phân công lớp ở đây
-- -----------------------------------------------------------------------------
CREATE TABLE public.class_subjects (
    id         uuid  DEFAULT public.uuid_generate_v4() NOT NULL,
    class_id   uuid  NOT NULL,
    subject_id uuid  NOT NULL,
    teacher_id uuid  NOT NULL,
    created_at timestamp DEFAULT now(),
    CONSTRAINT class_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT class_subjects_class_id_subject_id_key UNIQUE (class_id, subject_id)
);

-- -----------------------------------------------------------------------------
-- teacher_subjects: Môn học giáo viên/tổ trưởng được phép tạo câu hỏi, đề thi
-- Áp dụng cho cả role='teacher' lẫn role='department_head'
-- -----------------------------------------------------------------------------
CREATE TABLE public.teacher_subjects (
    id         uuid  DEFAULT public.uuid_generate_v4() NOT NULL,
    teacher_id uuid  NOT NULL,
    subject_id uuid  NOT NULL,
    created_at timestamp DEFAULT now(),
    CONSTRAINT teacher_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT teacher_subjects_teacher_id_subject_id_key UNIQUE (teacher_id, subject_id)
);
COMMENT ON TABLE public.teacher_subjects IS
  'Phân công giảng dạy: giáo viên được phép tạo đề và câu hỏi cho môn học nào';

-- -----------------------------------------------------------------------------
-- head_subjects: Môn học mà tổ trưởng phụ trách quản lý (để duyệt đề)
-- Lưu tên môn (không có số khối) vì tổ trưởng quản lý cả tổ nhiều khối
-- -----------------------------------------------------------------------------
CREATE TABLE public.head_subjects (
    id           uuid          DEFAULT public.uuid_generate_v4() NOT NULL,
    head_id      uuid          NOT NULL,
    subject_name varchar(100)  NOT NULL,   -- Ví dụ: "Toán", "Vật lý"
    created_at   timestamp     DEFAULT now(),
    CONSTRAINT head_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT head_subjects_head_id_subject_name_key UNIQUE (head_id, subject_name)
);
COMMENT ON TABLE public.head_subjects IS
  'Phân công tổ trưởng bộ môn: tổ trưởng phụ trách môn học nào (gồm tất cả khối)';

-- =============================================================================
-- NGÂN HÀNG CÂU HỎI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- questions: Ngân hàng câu hỏi (MCQ + tự luận)
-- correct_answer (jsonb):
--   - MCQ: số index của đáp án đúng, ví dụ 0, 1, 2, 3
--   - Essay: chuỗi đáp án mẫu (để NLP so sánh)
-- options (jsonb): mảng các lựa chọn cho MCQ, NULL cho tự luận
-- -----------------------------------------------------------------------------
CREATE TABLE public.questions (
    id             uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    subject_id     uuid    NOT NULL,
    created_by     uuid    NOT NULL,
    type           public.question_type     NOT NULL,
    content        text    NOT NULL,
    options        jsonb,                              -- Chỉ cho MCQ
    correct_answer jsonb   NOT NULL,                  -- Index (MCQ) hoặc đáp án mẫu (essay)
    difficulty     public.difficulty_level NOT NULL,
    is_approved    boolean DEFAULT false,
    approved_by    uuid,
    approved_at    timestamp,
    created_at     timestamp DEFAULT now(),
    CONSTRAINT questions_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- ĐỀ THI
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exams: Đề thi
-- Luồng trạng thái: draft → pending_approval → approved → (archived)
--                     ↑______ rejected (quay về draft để sửa) _____|
-- -----------------------------------------------------------------------------
CREATE TABLE public.exams (
    id               uuid     DEFAULT public.uuid_generate_v4() NOT NULL,
    title            varchar(200) NOT NULL,
    subject_id       uuid         NOT NULL,
    created_by       uuid         NOT NULL,
    approved_by      uuid,
    duration_minutes smallint     NOT NULL,
    status           public.exam_status DEFAULT 'draft',
    description      text,
    exam_type        varchar(20)  DEFAULT 'dinh_ky',  -- 'dinh_ky' | 'thuong_xuyen'
    rejection_reason text,       -- Lý do tổ trưởng từ chối (xóa khi tái nộp)
    rejected_at      timestamp,  -- Reset về NULL khi tái nộp
    approved_at      timestamp,
    created_at       timestamp    DEFAULT now(),
    CONSTRAINT exams_pkey PRIMARY KEY (id),
    CONSTRAINT exams_duration_minutes_check CHECK (duration_minutes > 0),
    CONSTRAINT exams_exam_type_check CHECK (exam_type IN ('dinh_ky', 'thuong_xuyen'))
);
COMMENT ON COLUMN public.exams.rejection_reason IS
  'Lý do tổ trưởng từ chối đề — bắt buộc nhập khi reject, hiển thị cho giáo viên để sửa';
COMMENT ON COLUMN public.exams.rejected_at IS
  'Thời điểm bị từ chối gần nhất — reset về NULL khi tái submit';

-- -----------------------------------------------------------------------------
-- exam_questions: Câu hỏi trong đề thi (có thứ tự và điểm)
-- -----------------------------------------------------------------------------
CREATE TABLE public.exam_questions (
    id          uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    exam_id     uuid    NOT NULL,
    question_id uuid    NOT NULL,
    order_index smallint    NOT NULL,
    score       numeric(4,2) NOT NULL,
    CONSTRAINT exam_questions_pkey PRIMARY KEY (id),
    CONSTRAINT exam_questions_exam_id_order_index_key UNIQUE (exam_id, order_index),
    CONSTRAINT exam_questions_exam_id_question_id_key UNIQUE (exam_id, question_id),
    CONSTRAINT exam_questions_score_check CHECK (score > 0)
);

-- -----------------------------------------------------------------------------
-- exam_matrix: Ma trận đề thi theo Thông tư 22/2021
-- Quy định số câu và điểm theo từng loại câu × mức độ nhận thức
-- -----------------------------------------------------------------------------
CREATE TABLE public.exam_matrix (
    id                 uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    exam_id            uuid    NOT NULL,
    type               public.question_type    NOT NULL,
    difficulty         public.difficulty_level NOT NULL,
    question_count     smallint     NOT NULL,
    score_per_question numeric(4,2) NOT NULL,
    topic_filter       text,   -- Lọc theo chủ đề cụ thể (tùy chọn)
    created_at         timestamp DEFAULT now(),
    CONSTRAINT exam_matrix_pkey PRIMARY KEY (id),
    CONSTRAINT exam_matrix_exam_id_type_difficulty_key UNIQUE (exam_id, type, difficulty),
    CONSTRAINT exam_matrix_question_count_check CHECK (question_count > 0),
    CONSTRAINT exam_matrix_score_per_question_check CHECK (score_per_question > 0)
);
COMMENT ON TABLE public.exam_matrix IS
  'Ma trận đề thi theo Thông tư 22/2021: phân bổ số câu và điểm theo loại câu × mức độ nhận thức';

-- -----------------------------------------------------------------------------
-- VIEW: Tóm tắt ma trận đề thi (kiểm tra tổng điểm = 10)
-- -----------------------------------------------------------------------------
CREATE VIEW public.exam_matrix_summary AS
SELECT
    em.exam_id,
    e.title AS exam_title,
    SUM(em.question_count) AS total_questions,
    SUM(em.question_count::numeric * em.score_per_question) AS total_score,
    CASE
        WHEN ABS(SUM(em.question_count::numeric * em.score_per_question) - 10) < 0.01
        THEN true ELSE false
    END AS is_score_valid,
    json_agg(json_build_object(
        'type', em.type,
        'difficulty', em.difficulty,
        'question_count', em.question_count,
        'score_per_question', em.score_per_question,
        'subtotal', em.question_count::numeric * em.score_per_question,
        'topic_filter', em.topic_filter
    ) ORDER BY em.type, em.difficulty) AS matrix_rows
FROM public.exam_matrix em
JOIN public.exams e ON em.exam_id = e.id
GROUP BY em.exam_id, e.title;

-- =============================================================================
-- TỔ CHỨC THI CỬ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- exam_schedules: Lịch thi (một đề có thể thi nhiều lớp ở các thời điểm khác nhau)
-- -----------------------------------------------------------------------------
CREATE TABLE public.exam_schedules (
    id          uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    exam_id     uuid    NOT NULL,
    class_id    uuid    NOT NULL,
    start_time  timestamp NOT NULL,
    end_time    timestamp NOT NULL,
    is_active   boolean   DEFAULT true,
    review_mode varchar(20) DEFAULT 'after_close',  -- Chế độ xem lại bài
    created_at  timestamp DEFAULT now(),
    CONSTRAINT exam_schedules_pkey PRIMARY KEY (id),
    CONSTRAINT exam_schedules_exam_id_class_id_key UNIQUE (exam_id, class_id),
    CONSTRAINT exam_schedules_check CHECK (end_time > start_time),
    CONSTRAINT exam_schedules_review_mode_check
        CHECK (review_mode IN ('never', 'after_submit', 'after_close'))
);

-- -----------------------------------------------------------------------------
-- exam_rooms: Phòng thi
-- -----------------------------------------------------------------------------
CREATE TABLE public.exam_rooms (
    id         uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    exam_id    uuid    NOT NULL,
    name       varchar(50) NOT NULL,
    capacity   smallint    DEFAULT 24 NOT NULL,
    created_at timestamp   DEFAULT now(),
    CONSTRAINT exam_rooms_pkey PRIMARY KEY (id)
);

-- -----------------------------------------------------------------------------
-- exam_room_students: Học sinh trong phòng thi
-- sbd: Số báo danh; seat_number: Số thứ tự chỗ ngồi
-- -----------------------------------------------------------------------------
CREATE TABLE public.exam_room_students (
    room_id     uuid NOT NULL,
    student_id  uuid NOT NULL,
    sbd         varchar(20),
    seat_number smallint,
    CONSTRAINT exam_room_students_pkey PRIMARY KEY (room_id, student_id)
);

-- =============================================================================
-- BÀI LÀM & CHẤM ĐIỂM
-- =============================================================================

-- -----------------------------------------------------------------------------
-- submissions: Bài làm của học sinh
-- question_order (jsonb): thứ tự câu hỏi (xáo trộn riêng mỗi HS)
-- -----------------------------------------------------------------------------
CREATE TABLE public.submissions (
    id             uuid    DEFAULT public.uuid_generate_v4() NOT NULL,
    schedule_id    uuid    NOT NULL,
    student_id     uuid    NOT NULL,
    question_order jsonb   NOT NULL,
    started_at     timestamp DEFAULT now(),
    submitted_at   timestamp,
    status         public.submission_status DEFAULT 'in_progress',
    CONSTRAINT submissions_pkey PRIMARY KEY (id),
    CONSTRAINT submissions_schedule_id_student_id_key UNIQUE (schedule_id, student_id)
);

-- -----------------------------------------------------------------------------
-- submission_answers: Câu trả lời từng câu hỏi trong bài làm
-- auto_score: Điểm chấm tự động (MCQ chấm ngay, essay do NLP gợi ý)
-- similarity_score: Độ tương đồng TF-IDF (0..1) của bài tự luận với đáp án mẫu
-- final_score: Điểm cuối do giáo viên quyết định (sau khi xem gợi ý NLP)
-- -----------------------------------------------------------------------------
CREATE TABLE public.submission_answers (
    id               uuid     DEFAULT public.uuid_generate_v4() NOT NULL,
    submission_id    uuid     NOT NULL,
    question_id      uuid     NOT NULL,
    student_answer   jsonb,                   -- Câu trả lời của học sinh
    auto_score       numeric(4,2),            -- Điểm tự động / điểm gợi ý NLP
    similarity_score numeric(5,4),            -- TF-IDF cosine similarity (essay)
    final_score      numeric(4,2),            -- Điểm giáo viên xác nhận
    graded_at        timestamp,
    CONSTRAINT submission_answers_pkey PRIMARY KEY (id),
    CONSTRAINT submission_answers_submission_id_question_id_key
        UNIQUE (submission_id, question_id)
);

-- -----------------------------------------------------------------------------
-- results: Kết quả tổng hợp của bài thi
-- -----------------------------------------------------------------------------
CREATE TABLE public.results (
    id            uuid     DEFAULT public.uuid_generate_v4() NOT NULL,
    submission_id uuid     NOT NULL,
    student_id    uuid     NOT NULL,
    exam_id       uuid     NOT NULL,
    total_score   numeric(5,2) NOT NULL,
    max_score     numeric(5,2) NOT NULL,
    graded_at     timestamp DEFAULT now(),
    CONSTRAINT results_pkey PRIMARY KEY (id),
    CONSTRAINT results_submission_id_key UNIQUE (submission_id)
);

-- =============================================================================
-- RÀNG BUỘC KHÓA NGOẠI (FOREIGN KEYS)
-- =============================================================================

-- users
ALTER TABLE public.users
    ADD CONSTRAINT users_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.classes(id);

-- classes
ALTER TABLE public.classes
    ADD CONSTRAINT classes_homeroom_teacher_id_fkey
        FOREIGN KEY (homeroom_teacher_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- class_subjects
ALTER TABLE public.class_subjects
    ADD CONSTRAINT class_subjects_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    ADD CONSTRAINT class_subjects_subject_id_fkey
        FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
    ADD CONSTRAINT class_subjects_teacher_id_fkey
        FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- teacher_subjects
ALTER TABLE public.teacher_subjects
    ADD CONSTRAINT teacher_subjects_teacher_id_fkey
        FOREIGN KEY (teacher_id) REFERENCES public.users(id) ON DELETE CASCADE,
    ADD CONSTRAINT teacher_subjects_subject_id_fkey
        FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- head_subjects
ALTER TABLE public.head_subjects
    ADD CONSTRAINT head_subjects_head_id_fkey
        FOREIGN KEY (head_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- questions
ALTER TABLE public.questions
    ADD CONSTRAINT questions_subject_id_fkey
        FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
    ADD CONSTRAINT questions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id),
    ADD CONSTRAINT questions_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES public.users(id);

-- exams
ALTER TABLE public.exams
    ADD CONSTRAINT exams_subject_id_fkey
        FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
    ADD CONSTRAINT exams_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.users(id),
    ADD CONSTRAINT exams_approved_by_fkey
        FOREIGN KEY (approved_by) REFERENCES public.users(id);

-- exam_questions
ALTER TABLE public.exam_questions
    ADD CONSTRAINT exam_questions_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE,
    ADD CONSTRAINT exam_questions_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES public.questions(id);

-- exam_matrix
ALTER TABLE public.exam_matrix
    ADD CONSTRAINT exam_matrix_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- exam_schedules
ALTER TABLE public.exam_schedules
    ADD CONSTRAINT exam_schedules_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES public.exams(id),
    ADD CONSTRAINT exam_schedules_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.classes(id);

-- exam_rooms
ALTER TABLE public.exam_rooms
    ADD CONSTRAINT exam_rooms_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES public.exams(id) ON DELETE CASCADE;

-- exam_room_students
ALTER TABLE public.exam_room_students
    ADD CONSTRAINT exam_room_students_room_id_fkey
        FOREIGN KEY (room_id) REFERENCES public.exam_rooms(id) ON DELETE CASCADE,
    ADD CONSTRAINT exam_room_students_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- submissions
ALTER TABLE public.submissions
    ADD CONSTRAINT submissions_schedule_id_fkey
        FOREIGN KEY (schedule_id) REFERENCES public.exam_schedules(id),
    ADD CONSTRAINT submissions_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES public.users(id);

-- submission_answers
ALTER TABLE public.submission_answers
    ADD CONSTRAINT submission_answers_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.submissions(id) ON DELETE CASCADE,
    ADD CONSTRAINT submission_answers_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES public.questions(id);

-- results
ALTER TABLE public.results
    ADD CONSTRAINT results_submission_id_fkey
        FOREIGN KEY (submission_id) REFERENCES public.submissions(id),
    ADD CONSTRAINT results_student_id_fkey
        FOREIGN KEY (student_id) REFERENCES public.users(id),
    ADD CONSTRAINT results_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES public.exams(id);

-- =============================================================================
-- CHỈ MỤC (INDEXES) — tăng hiệu năng truy vấn thường xuyên
-- =============================================================================

CREATE INDEX idx_class_subjects_class     ON public.class_subjects   USING btree (class_id);
CREATE INDEX idx_class_subjects_teacher   ON public.class_subjects   USING btree (teacher_id);
CREATE INDEX idx_teacher_subjects_teacher ON public.teacher_subjects USING btree (teacher_id);
CREATE INDEX idx_teacher_subjects_subject ON public.teacher_subjects USING btree (subject_id);
CREATE INDEX idx_head_subjects_head       ON public.head_subjects    USING btree (head_id);
CREATE INDEX idx_questions_subject        ON public.questions        USING btree (subject_id);
CREATE INDEX idx_questions_type           ON public.questions        USING btree (type);
CREATE INDEX idx_questions_difficulty     ON public.questions        USING btree (difficulty);
CREATE INDEX idx_questions_approved       ON public.questions        USING btree (is_approved);
CREATE INDEX idx_exam_matrix_exam_id      ON public.exam_matrix      USING btree (exam_id);
CREATE INDEX idx_schedules_class          ON public.exam_schedules   USING btree (class_id);
CREATE INDEX idx_schedules_time           ON public.exam_schedules   USING btree (start_time, end_time);
CREATE INDEX idx_results_student          ON public.results          USING btree (student_id);
CREATE INDEX idx_results_exam             ON public.results          USING btree (exam_id);

-- =============================================================================
-- TRIGGER
-- =============================================================================

-- Tự động xóa rejection_reason khi giáo viên tái nộp đề sau khi bị từ chối
CREATE TRIGGER trg_clear_rejection
    BEFORE UPDATE ON public.exams
    FOR EACH ROW EXECUTE FUNCTION public.clear_rejection_on_submit();

-- =============================================================================
-- TÀI KHOẢN ADMIN MẶC ĐỊNH
-- Mật khẩu: admin123 (bcrypt hash)
-- Thay đổi ngay sau khi triển khai!
-- =============================================================================
INSERT INTO public.users (full_name, email, password_hash, role)
VALUES (
    'Quản trị viên',
    'admin@thpt.edu.vn',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- admin123
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- =============================================================================
-- GHI CHÚ CẤU TRÚC HỆ THỐNG
-- =============================================================================
--
-- CẤU TRÚC LỚP HỌC (36 lớp):
--   Mỗi khối (10, 11, 12) có:
--     - 7 lớp KHTN : T1, T2, T3, T4, T5, T6, T7
--     - 5 lớp KHXH : X1, X2, X3, X4, X5
--
-- TỔ HỢP MÔN HỌC:
--   Môn bắt buộc tất cả lớp : Toán, Ngữ văn, Tiếng Anh, Lịch sử
--   T1–T5 : Vật lý, Hóa học, Sinh học, Tin học
--   T6    : Vật lý, Hóa học, Sinh học, Địa lý
--   T7    : Vật lý, Tin học, Địa lý
--   X1,X2 : Địa lý, GDKTPL, Tin học, Công nghệ Công nghiệp
--   X3,X4 : Địa lý, GDKTPL, Tin học, Công nghệ Nông nghiệp
--   X5    : Địa lý, GDKTPL, Tin học
--
-- QUY TẮC PHÂN CÔNG GIÁO VIÊN:
--   - Mỗi giáo viên dạy đúng 1 khối (10 hoặc 11 hoặc 12)
--   - Các lớp phụ trách xếp liền kề (không rải rác)
--   - Toán/Văn/Anh: ~8 lớp/GV; Tin học/Lịch sử: ~6 lớp/GV; môn khác: ~4 lớp/GV
--   - Tổ trưởng (department_head) cũng được phân công lớp giảng dạy
--
-- QUY TRÌNH CHẤM TỰ LUẬN:
--   1. HS nộp bài → Backend gửi sang NLP Service (Flask:5001)
--   2. NLP tính TF-IDF + Keyword Coverage + Gemini AI → gợi ý điểm
--   3. Điểm gợi ý lưu vào submission_answers.auto_score và similarity_score
--   4. GV xem gợi ý → quyết định final_score + nhận xét
--
-- =============================================================================

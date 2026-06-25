-- =============================================================================
-- MIGRATION: Đổi difficulty_level từ 4 mức → 3 mức
-- Theo Công văn số 7991/BGDĐT-GDTrH ngày 17/12/2024 của Bộ GDĐT
-- Áp dụng: Biết / Hiểu / Vận dụng (thay cho Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao)
--
-- Quy tắc gộp: van_dung_cao → van_dung
-- Giữ nguyên key DB (nhan_biet / thong_hieu / van_dung) — chỉ xóa van_dung_cao
-- Rollback an toàn: xem phần ROLLBACK ở cuối file
-- =============================================================================

BEGIN;

-- BƯỚC 1: Kiểm tra số lượng bản ghi bị ảnh hưởng
DO $$
DECLARE
  q_count INTEGER;
  m_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO q_count FROM questions    WHERE difficulty = 'van_dung_cao';
  SELECT COUNT(*) INTO m_count FROM exam_matrix  WHERE difficulty = 'van_dung_cao';
  RAISE NOTICE '>>> Câu hỏi sẽ được gộp (van_dung_cao → van_dung): % bản ghi', q_count;
  RAISE NOTICE '>>> Ma trận đề thi sẽ được gộp:                          % bản ghi', m_count;
END $$;

-- BƯỚC 2: Gộp dữ liệu cũ — van_dung_cao → van_dung
-- Lưu ý: exam_matrix có UNIQUE(exam_id, type, difficulty)
-- → Nếu đã tồn tại (exam_id, type, 'van_dung'), cần gộp question_count + score (dùng ON CONFLICT)
UPDATE questions
   SET difficulty = 'van_dung'
 WHERE difficulty = 'van_dung_cao';

-- Xử lý exam_matrix cẩn thận hơn vì có UNIQUE constraint
-- Nếu exam_matrix có cả van_dung và van_dung_cao trong cùng (exam_id, type):
-- → Tăng question_count của van_dung, xóa van_dung_cao
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      m_cao.id            AS cao_id,
      m_vd.id             AS vd_id,
      m_cao.question_count AS cao_count,
      m_vd.question_count  AS vd_count
    FROM exam_matrix m_cao
    JOIN exam_matrix m_vd
      ON m_vd.exam_id   = m_cao.exam_id
     AND m_vd.type      = m_cao.type
     AND m_vd.difficulty = 'van_dung'
    WHERE m_cao.difficulty = 'van_dung_cao'
  LOOP
    -- Cộng question_count vào hàng van_dung đã có
    UPDATE exam_matrix
       SET question_count = rec.vd_count + rec.cao_count
     WHERE id = rec.vd_id;
    -- Xóa hàng van_dung_cao (không còn cần thiết)
    DELETE FROM exam_matrix WHERE id = rec.cao_id;
    RAISE NOTICE 'Đã gộp exam_matrix: van_dung_cao (id=%) → van_dung (id=%)', rec.cao_id, rec.vd_id;
  END LOOP;
END $$;

-- Hàng van_dung_cao còn lại (không có van_dung cùng exam_id+type) → đổi trực tiếp
UPDATE exam_matrix
   SET difficulty = 'van_dung'
 WHERE difficulty = 'van_dung_cao';

-- BƯỚC 3: Tạo ENUM type mới chỉ có 3 giá trị
-- PostgreSQL không cho phép DROP ENUM VALUE trực tiếp → phải tạo type mới
CREATE TYPE public.difficulty_level_new AS ENUM (
    'nhan_biet',  -- Biết
    'thong_hieu', -- Hiểu
    'van_dung'    -- Vận dụng
);

-- BƯỚC 4: Chuyển cột questions.difficulty sang type mới
ALTER TABLE public.questions
  ALTER COLUMN difficulty TYPE public.difficulty_level_new
  USING difficulty::text::public.difficulty_level_new;

-- BƯỚC 5: Chuyển cột exam_matrix.difficulty sang type mới
ALTER TABLE public.exam_matrix
  ALTER COLUMN difficulty TYPE public.difficulty_level_new
  USING difficulty::text::public.difficulty_level_new;

-- BƯỚC 6: Xóa type cũ, đặt tên type mới = tên cũ
DROP TYPE public.difficulty_level;
ALTER TYPE public.difficulty_level_new RENAME TO difficulty_level;

-- BƯỚC 7: Xác nhận kết quả
DO $$
DECLARE
  q_biet  INTEGER; q_hieu INTEGER; q_vd INTEGER; q_old INTEGER;
BEGIN
  SELECT COUNT(*) INTO q_biet FROM questions WHERE difficulty = 'nhan_biet';
  SELECT COUNT(*) INTO q_hieu FROM questions WHERE difficulty = 'thong_hieu';
  SELECT COUNT(*) INTO q_vd   FROM questions WHERE difficulty = 'van_dung';
  SELECT COUNT(*) INTO q_old  FROM questions WHERE difficulty::text NOT IN ('nhan_biet','thong_hieu','van_dung');
  RAISE NOTICE '=== Kết quả sau migration ===';
  RAISE NOTICE 'nhan_biet (Biết):  % câu hỏi', q_biet;
  RAISE NOTICE 'thong_hieu (Hiểu): % câu hỏi', q_hieu;
  RAISE NOTICE 'van_dung (Vận dụng): % câu hỏi', q_vd;
  RAISE NOTICE 'Còn sót giá trị cũ: % (phải = 0)', q_old;
END $$;

COMMIT;

-- =============================================================================
-- ROLLBACK (chạy thủ công nếu cần hoàn nguyên)
-- =============================================================================
-- Lưu ý: Sau khi COMMIT, dữ liệu van_dung_cao đã bị gộp → KHÔNG thể khôi phục
-- hoàn toàn (chỉ khôi phục được structure ENUM, không biết câu nào cũ là VDC)
--
-- BEGIN;
-- CREATE TYPE public.difficulty_level_old AS ENUM (
--     'nhan_biet', 'thong_hieu', 'van_dung', 'van_dung_cao'
-- );
-- ALTER TABLE public.questions
--   ALTER COLUMN difficulty TYPE public.difficulty_level_old
--   USING difficulty::text::public.difficulty_level_old;
-- ALTER TABLE public.exam_matrix
--   ALTER COLUMN difficulty TYPE public.difficulty_level_old
--   USING difficulty::text::public.difficulty_level_old;
-- DROP TYPE public.difficulty_level;
-- ALTER TYPE public.difficulty_level_old RENAME TO difficulty_level;
-- COMMIT;
-- =============================================================================

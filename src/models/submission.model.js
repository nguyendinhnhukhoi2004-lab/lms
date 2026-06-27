// models/submission.model.js
// Query cho bảng submissions và submission_answers
// Đây là trái tim của phòng thi

const { query, getClient } = require('../config/db');

// ============================================================
// SUBMISSIONS
// ============================================================

// Kiểm tra học sinh đã có bài nộp cho kỳ thi này chưa
const findByStudentAndSchedule = async (student_id, schedule_id) => {
  const { rows } = await query(
    `SELECT * FROM submissions
     WHERE student_id=$1 AND schedule_id=$2`,
    [student_id, schedule_id]
  );
  return rows[0] || null;
};

// Tìm submission theo id — kèm thông tin schedule và exam
const findById = async (id) => {
  const { rows } = await query(
    `SELECT
       s.*,
       es.exam_id,
       es.start_time,
       es.end_time,
       e.title       AS exam_title,
       e.duration_minutes,
       e.subject_id
     FROM submissions s
     JOIN exam_schedules es ON s.schedule_id = es.id
     JOIN exams         e  ON es.exam_id     = e.id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Tạo bài nộp mới khi học sinh vào phòng thi
// question_order: snapshot thứ tự xáo trộn { order: [...], option_shuffle: {...} }
const create = async (student_id, schedule_id, question_order) => {
  const { rows } = await query(
    `INSERT INTO submissions (student_id, schedule_id, question_order)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [student_id, schedule_id, JSON.stringify(question_order)]
  );
  return rows[0];
};

// Lấy tất cả câu trả lời hiện tại của bài nộp
const findAnswers = async (submission_id) => {
  const { rows } = await query(
    `SELECT
       sa.question_id,
       sa.student_answer,
       sa.auto_score,
       sa.final_score,
       sa.similarity_score,
       sa.nlp_detail,
       q.type         AS question_type,
       q.content      AS question_content,
       q.correct_answer
     FROM submission_answers sa
     JOIN questions q ON sa.question_id = q.id
     WHERE sa.submission_id=$1`,
    [submission_id]
  );
  return rows;
};

// Lưu / cập nhật câu trả lời 1 câu (upsert)
// Gọi mỗi khi học sinh chọn đáp án (auto-save)
const upsertAnswer = async (submission_id, question_id, student_answer) => {
  const { rows } = await query(
    `INSERT INTO submission_answers (submission_id, question_id, student_answer)
     VALUES ($1, $2, $3)
     ON CONFLICT (submission_id, question_id)
     DO UPDATE SET student_answer=$3
     RETURNING *`,
    [submission_id, question_id, JSON.stringify(student_answer)]
  );
  return rows[0];
};

// Nộp bài: cập nhật status + submitted_at
const submit = async (submission_id) => {
  const { rows } = await query(
    `UPDATE submissions
     SET status='submitted', submitted_at=NOW()
     WHERE id=$1 AND status='in_progress'
     RETURNING *`,
    [submission_id]
  );
  return rows[0] || null;
};

// Chấm điểm trắc nghiệm và lưu auto_score
// Gọi ngay sau khi nộp bài
const saveAutoScores = async (submission_id, scores) => {
  // scores: [{ question_id, auto_score }]
  // Dùng UPSERT vì học sinh có thể bỏ qua câu (row chưa tồn tại trong submission_answers)
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const { question_id, auto_score } of scores) {
      await client.query(
        `INSERT INTO submission_answers
           (submission_id, question_id, student_answer, auto_score, final_score, graded_at)
         VALUES ($1, $2, NULL, $3, $3, NOW())
         ON CONFLICT (submission_id, question_id)
         DO UPDATE SET
           auto_score  = EXCLUDED.auto_score,
           final_score = EXCLUDED.auto_score,
           graded_at   = NOW()`,
        [submission_id, question_id, auto_score]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Lưu kết quả điểm tương đồng từ Python NLP (cho câu tự luận)
const saveSimilarityScore = async (submission_id, question_id, similarity_score, auto_score, nlp_detail = null) => {
  // Dùng UPSERT: học sinh có thể không viết gì vào tự luận (row chưa tồn tại)
  await query(
    `INSERT INTO submission_answers
       (submission_id, question_id, student_answer, similarity_score, auto_score, nlp_detail, graded_at)
     VALUES ($3, $4, NULL, $1, $2, $5, NOW())
     ON CONFLICT (submission_id, question_id)
     DO UPDATE SET
       similarity_score = EXCLUDED.similarity_score,
       auto_score       = EXCLUDED.auto_score,
       nlp_detail       = EXCLUDED.nlp_detail,
       graded_at        = NOW()`,
    [similarity_score, auto_score, submission_id, question_id, nlp_detail ? JSON.stringify(nlp_detail) : null]
  );
};

// Cập nhật điểm cuối do giáo viên chỉnh (chỉ cho tự luận)
const updateFinalScore = async (submission_id, question_id, final_score) => {
  const { rows } = await query(
    `UPDATE submission_answers
     SET final_score=$1, graded_at=NOW()
     WHERE submission_id=$2 AND question_id=$3
     RETURNING *`,
    [final_score, submission_id, question_id]
  );
  return rows[0] || null;
};

// Tạo bản ghi kết quả tổng kết sau khi chấm xong
const createResult = async (submission_id, student_id, exam_id, total_score, max_score) => {
  const { rows } = await query(
    `INSERT INTO results (submission_id, student_id, exam_id, total_score, max_score)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (submission_id) DO UPDATE
     SET total_score=$4, max_score=$5, graded_at=NOW()
     RETURNING *`,
    [submission_id, student_id, exam_id, total_score, max_score]
  );
  return rows[0];
};

// Lấy kết quả tổng của 1 bài nộp
const findResult = async (submission_id) => {
  const { rows } = await query(
    `SELECT r.*, e.title AS exam_title, s.name AS subject_name
     FROM results r
     JOIN exams   e ON r.exam_id = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE r.submission_id=$1`,
    [submission_id]
  );
  return rows[0] || null;
};

// Lấy danh sách kết quả của 1 học sinh
const findResultsByStudent = async (student_id) => {
  const { rows } = await query(
    `SELECT r.*, e.title AS exam_title, s.name AS subject_name, s.grade
     FROM results r
     JOIN exams    e ON r.exam_id    = e.id
     JOIN subjects s ON e.subject_id = s.id
     WHERE r.student_id=$1
     ORDER BY r.graded_at DESC`,
    [student_id]
  );
  return rows;
};

// Lấy kết quả theo lịch thi (dành cho giáo viên xem toàn lớp)
const findResultsBySchedule = async (schedule_id) => {
  const { rows } = await query(
    `SELECT
       sub.id       AS submission_id,
       r.total_score, r.max_score, r.graded_at,
       u.full_name  AS student_name,
       u.id         AS student_id,
       c.name       AS class_name,
       sub.submitted_at,
       sub.status,
       -- has_essay_pending: true nếu có ít nhất 1 câu tự luận chưa có final_score
       EXISTS (
         SELECT 1 FROM submission_answers sa
         JOIN questions q ON sa.question_id = q.id
         WHERE sa.submission_id = sub.id
           AND q.type = 'essay'
           AND sa.final_score IS NULL
       ) AS has_essay_pending
     FROM submissions sub
     JOIN users   u ON sub.student_id = u.id
     LEFT JOIN classes c ON u.class_id = c.id
     LEFT JOIN results r ON r.submission_id = sub.id
     WHERE sub.schedule_id=$1
     ORDER BY r.total_score DESC NULLS LAST`,
    [schedule_id]
  );
  return rows;
};

module.exports = {
  findByStudentAndSchedule, findById, create,
  findAnswers, upsertAnswer, submit,
  saveAutoScores, saveSimilarityScore, updateFinalScore,
  createResult, findResult, findResultsByStudent, findResultsBySchedule,
};

// models/exam.model.js
// Query cho bảng exams, exam_questions, exam_schedules

const { query, getClient } = require('../config/db');

// ============================================================
// EXAMS
// ============================================================

// Lấy danh sách đề thi — lọc theo trạng thái và người tạo
const findAll = async ({ subject_id, status, created_by, subject_ids, subject_names, page = 1, limit = 20 } = {}) => {
  const params = [];
  let sql = `
    SELECT
      e.id, e.title, e.duration_minutes, e.status, e.exam_type, e.created_at, e.approved_at,
      e.created_by,
      s.name  AS subject_name,
      s.grade AS subject_grade,
      u.full_name AS created_by_name,
      a.full_name AS approved_by_name,
      COUNT(eq.id)::int AS question_count,
      COALESCE(SUM(eq.score), 0) AS total_score
    FROM exams e
    JOIN subjects s ON e.subject_id = s.id
    JOIN users    u ON e.created_by  = u.id
    LEFT JOIN users    a  ON e.approved_by = a.id
    LEFT JOIN exam_questions eq ON eq.exam_id = e.id
    WHERE TRUE
  `;

  if (subject_id)    { params.push(subject_id);    sql += ` AND e.subject_id  = $${params.length}`; }
  if (status)        { params.push(status);         sql += ` AND e.status      = $${params.length}`; }
  if (created_by)    { params.push(created_by);     sql += ` AND e.created_by  = $${params.length}`; }
  // Giáo viên: chỉ thấy đề trong các môn được phân công
  if (subject_ids && subject_ids.length > 0) {
    params.push(subject_ids);
    sql += ` AND e.subject_id = ANY($${params.length})`;
  }
  // Tổ trưởng: chỉ thấy đề thuộc tên môn mình phụ trách (vd: "Toán" → Toán 10+11+12)
  if (subject_names && subject_names.length > 0) {
    const patterns = subject_names.map(name => `${name.trim()}%`);
    params.push(patterns);
    sql += ` AND s.name ILIKE ANY($${params.length})`;
  }

  sql += ' GROUP BY e.id, e.created_by, s.name, s.grade, u.full_name, a.full_name';
  sql += ' ORDER BY e.created_at DESC';

  // Đếm tổng
  const countSql = `SELECT COUNT(*) FROM (${sql}) AS sub`;
  const countResult = await query(countSql, params);
  const total = parseInt(countResult.rows[0].count);

  const offset = (page - 1) * limit;
  params.push(limit, offset);
  sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return { exams: rows, total, page, limit };
};

// Lấy chi tiết 1 đề thi kèm danh sách câu hỏi
const findById = async (id) => {
  // Lấy thông tin đề
  const { rows: examRows } = await query(
    `SELECT
       e.*,
       s.name  AS subject_name,
       s.grade AS subject_grade,
       u.full_name AS created_by_name,
       a.full_name AS approved_by_name
     FROM exams e
     JOIN subjects s ON e.subject_id = s.id
     JOIN users    u ON e.created_by  = u.id
     LEFT JOIN users a ON e.approved_by = a.id
     WHERE e.id = $1`,
    [id]
  );
  if (!examRows[0]) return null;

  // Lấy danh sách câu hỏi trong đề, bao gồm correct_answer để dùng khi chấm và trả kết quả
  const { rows: questions } = await query(
    `SELECT
       eq.id AS exam_question_id,
       eq.order_index,
       eq.score,
       q.id, q.type, q.content, q.options, q.difficulty, q.correct_answer
     FROM exam_questions eq
     JOIN questions q ON eq.question_id = q.id
     WHERE eq.exam_id = $1
     ORDER BY eq.order_index`,
    [id]
  );

  return { ...examRows[0], questions };
};

// Tạo đề thi mới (chưa có câu hỏi) — dùng transaction
const create = async ({ title, subject_id, created_by, duration_minutes, description }) => {
  const { rows } = await query(
    `INSERT INTO exams (title, subject_id, created_by, duration_minutes, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, subject_id, created_by, duration_minutes, description || null]
  );
  return rows[0];
};

// Thêm câu hỏi vào đề — dùng transaction để đảm bảo toàn vẹn
// questions: [{question_id, score}]
const addQuestions = async (exam_id, questions) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Xóa câu hỏi cũ nếu có (khi cập nhật lại đề)
    await client.query('DELETE FROM exam_questions WHERE exam_id = $1', [exam_id]);

    // Thêm từng câu hỏi với thứ tự tăng dần
    for (let i = 0; i < questions.length; i++) {
      const { question_id, score } = questions[i];
      await client.query(
        `INSERT INTO exam_questions (exam_id, question_id, order_index, score)
         VALUES ($1, $2, $3, $4)`,
        [exam_id, question_id, i + 1, score]
      );
    }

    await client.query('COMMIT');

    // Trả về đề thi vừa cập nhật
    return await findById(exam_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};


// Tính tổng điểm của đề thi — dùng để validate trước khi submit
const getTotalScore = async (id) => {
  const { rows } = await query(
    `SELECT COALESCE(SUM(score), 0)::numeric AS total_score
     FROM exam_questions
     WHERE exam_id = $1`,
    [id]
  );
  return parseFloat(rows[0].total_score);
};

// Gửi đề lên tổ trưởng phê duyệt
const submitForApproval = async (id) => {
  const { rows } = await query(
    `UPDATE exams SET status='pending_approval'
     WHERE id=$1 AND status='draft'
     RETURNING id, title, status`,
    [id]
  );
  return rows[0] || null;
};

// Tổ trưởng phê duyệt đề
const approve = async (id, approved_by) => {
  const { rows } = await query(
    `UPDATE exams
     SET status='approved', approved_by=$2, approved_at=NOW()
     WHERE id=$1 AND status='pending_approval'
     RETURNING id, title, status, approved_at`,
    [id, approved_by]
  );
  return rows[0] || null;
};

// Từ chối đề — quay về draft để giáo viên chỉnh sửa, lưu lý do từ chối
const reject = async (id, rejection_reason) => {
  const { rows } = await query(
    `UPDATE exams
     SET status='draft', approved_by=NULL, approved_at=NULL,
         rejection_reason=$2, rejected_at=NOW()
     WHERE id=$1 AND status='pending_approval'
     RETURNING id, title, status, rejection_reason, rejected_at`,
    [id, rejection_reason || null]
  );
  return rows[0] || null;
};

// Lưu trữ đề (không dùng nữa)
const archive = async (id) => {
  const { rows } = await query(
    `UPDATE exams SET status='archived'
     WHERE id=$1
     RETURNING id, title, status`,
    [id]
  );
  return rows[0] || null;
};

// Xóa đề thi hoàn toàn (chỉ xóa khi chưa phê duyệt / bản nháp)
const deleteExam = async (id) => {
  const { rows } = await query(
    `DELETE FROM exams WHERE id = $1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
};

// ============================================================
// EXAM SCHEDULES — lên lịch thi cho lớp
// ============================================================

// Lấy danh sách lịch thi — lọc theo lớp hoặc đề thi
const findSchedules = async ({ exam_id, class_id, is_active } = {}) => {
  const params = [];
  let sql = `
    SELECT
      es.*,
      e.title AS exam_title,
      e.duration_minutes,
      e.subject_id,
      c.name  AS class_name,
      c.grade AS class_grade
    FROM exam_schedules es
    JOIN exams   e ON es.exam_id  = e.id
    JOIN classes c ON es.class_id = c.id
    WHERE TRUE
  `;

  if (exam_id)    { params.push(exam_id);    sql += ` AND es.exam_id  = $${params.length}`; }
  if (class_id)   { params.push(class_id);   sql += ` AND es.class_id = $${params.length}`; }
  if (is_active !== undefined) {
    params.push(is_active);
    sql += ` AND es.is_active = $${params.length}`;
  }

  sql += ' ORDER BY es.start_time DESC';
  const { rows } = await query(sql, params);
  return rows;
};

// Lấy lịch thi hiện tại của học sinh (đang trong khung giờ)
const findActiveScheduleForStudent = async (student_id) => {
  const { rows } = await query(
    `SELECT es.*, e.title AS exam_title, e.duration_minutes, e.subject_id
     FROM exam_schedules es
     JOIN exams   e ON es.exam_id  = e.id
     JOIN users   u ON u.class_id  = es.class_id
     WHERE u.id = $1
       AND es.is_active = TRUE
       AND NOW() BETWEEN es.start_time AND es.end_time`,
    [student_id]
  );
  return rows; // có thể có nhiều lịch thi cùng lúc
};

// Tìm 1 lịch thi theo id — dùng thay cho findSchedules() + filter trong JS
const findScheduleById = async (id) => {
  const { rows } = await query(
    `SELECT
       es.*,
       e.title AS exam_title,
       e.duration_minutes,
       c.name  AS class_name,
       c.grade AS class_grade
     FROM exam_schedules es
     JOIN exams   e ON es.exam_id  = e.id
     JOIN classes c ON es.class_id = c.id
     WHERE es.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Tìm lịch theo exam_id + class_id
const findScheduleByExamClass = async (exam_id, class_id) => {
  const { rows } = await query(
    `SELECT * FROM exam_schedules
     WHERE exam_id=$1 AND class_id=$2
     LIMIT 1`,
    [exam_id, class_id]
  );
  return rows[0] || null;
};

// Tạo lịch thi cho lớp
const createSchedule = async ({ exam_id, class_id, start_time, end_time, review_mode = 'after_close' }) => {
  const { rows } = await query(
    `INSERT INTO exam_schedules (exam_id, class_id, start_time, end_time, review_mode)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [exam_id, class_id, start_time, end_time, review_mode]
  );
  return rows[0];
};

// Hủy lịch thi
const cancelSchedule = async (id) => {
  const { rows } = await query(
    `UPDATE exam_schedules SET is_active=FALSE
     WHERE id=$1
     RETURNING id, is_active`,
    [id]
  );
  return rows[0] || null;
};

// Cập nhật (dời) lịch thi — thay đổi start_time, end_time và kích hoạt lại nếu cần
const updateSchedule = async (id, { start_time, end_time }) => {
  const { rows } = await query(
    `UPDATE exam_schedules
     SET start_time=$2, end_time=$3, is_active=TRUE
     WHERE id=$1
     RETURNING *`,
    [id, start_time, end_time]
  );
  return rows[0] || null;
};

// Xóa hoàn toàn lịch thi (dùng khi muốn remove record)
const deleteSchedule = async (id) => {
  const { rows } = await query(
    `DELETE FROM exam_schedules WHERE id=$1 RETURNING id`,
    [id]
  );
  return rows[0] || null;
};



// ============================================================
// EXAM MATRIX — ma trận đề thi theo Thông tư 22
// ============================================================

// Lấy ma trận của 1 đề thi
const getMatrix = async (exam_id) => {
  const { rows } = await query(
    `SELECT id, type, difficulty, question_count, score_per_question, topic_filter,
            (question_count * score_per_question) AS subtotal
     FROM exam_matrix
     WHERE exam_id = $1
     ORDER BY type, difficulty`,
    [exam_id]
  );
  return rows;
};

// Lấy summary: tổng câu, tổng điểm, kiểm tra hợp lệ
const getMatrixSummary = async (exam_id) => {
  const { rows } = await query(
    `SELECT total_questions, total_score, is_score_valid, matrix_rows
     FROM exam_matrix_summary
     WHERE exam_id = $1`,
    [exam_id]
  );
  return rows[0] || null;
};

// Upsert toàn bộ ma trận (xóa cũ, thêm mới trong 1 transaction)
// rows: [{ type, difficulty, question_count, score_per_question, topic_filter? }]
const setMatrix = async (exam_id, rows_data) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Xóa ma trận cũ
    await client.query('DELETE FROM exam_matrix WHERE exam_id = $1', [exam_id]);

    // Validate tổng điểm trước khi lưu
    const total = rows_data.reduce(
      (sum, r) => sum + r.question_count * r.score_per_question, 0
    );
    if (Math.abs(total - 10) > 0.01) {
      throw new Error(
        `Ma trận không hợp lệ: tổng điểm phải đúng 10 (hiện tại: ${total.toFixed(2)})`
      );
    }

    // Insert từng dòng ma trận
    for (const r of rows_data) {
      await client.query(
        `INSERT INTO exam_matrix
           (exam_id, type, difficulty, question_count, score_per_question, topic_filter)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          exam_id,
          r.type,
          r.difficulty,
          r.question_count,
          r.score_per_question,
          r.topic_filter || null,
        ]
      );
    }

    await client.query('COMMIT');
    return await getMatrix(exam_id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Xóa ma trận (khi đề quay về draft sau khi bị reject)
const deleteMatrix = async (exam_id) => {
  await query('DELETE FROM exam_matrix WHERE exam_id = $1', [exam_id]);
};

module.exports = {
  findAll, findById, create, addQuestions,
  getTotalScore, submitForApproval, approve, reject, archive, deleteExam,
  findSchedules, findScheduleById, findScheduleByExamClass, findActiveScheduleForStudent, createSchedule, cancelSchedule, updateSchedule, deleteSchedule,
  getMatrix, getMatrixSummary, setMatrix, deleteMatrix,
};

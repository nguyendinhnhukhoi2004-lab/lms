// models/question.model.js
// Tất cả query liên quan đến bảng questions
// Lưu ý: options và correct_answer là JSONB — PostgreSQL tự parse thành object JS

const { query, getClient } = require('../config/db');

// Lấy danh sách câu hỏi — lọc đa điều kiện, có phân trang
const findAll = async ({ subject_id, subject_ids, type, difficulty, is_approved, created_by, page = 1, limit = 20 } = {}) => {
  const params = [];
  let sql = `
    SELECT
      q.id, q.type, q.content, q.options, q.correct_answer, q.difficulty,
      q.is_approved, q.created_at,
      s.name  AS subject_name,
      s.grade AS subject_grade,
      u.full_name AS created_by_name
    FROM questions q
    JOIN subjects s ON q.subject_id = s.id
    JOIN users    u ON q.created_by  = u.id
    WHERE TRUE
  `;

  // Thêm điều kiện lọc động
  if (subject_id)  { params.push(subject_id);  sql += ` AND q.subject_id = $${params.length}`; }
  if (subject_ids && subject_ids.length > 0) {
    params.push(subject_ids);
    sql += ` AND q.subject_id = ANY($${params.length})`;
  }
  if (type)        { params.push(type);         sql += ` AND q.type = $${params.length}`; }
  if (difficulty)  { params.push(difficulty);   sql += ` AND q.difficulty = $${params.length}`; }
  if (is_approved !== undefined) {
    params.push(is_approved);
    sql += ` AND q.is_approved = $${params.length}`;
  }
  if (created_by)  { params.push(created_by);   sql += ` AND q.created_by = $${params.length}`; }

  // Đếm tổng (dùng cho phân trang)
  const countResult = await query(`SELECT COUNT(*) FROM (${sql}) AS sub`, params);
  const total = parseInt(countResult.rows[0].count);

  // Phân trang
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  sql += ` ORDER BY q.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  return { questions: rows, total, page, limit };
};

// Lấy chi tiết 1 câu hỏi (có correct_answer — chỉ dùng phía server, không trả về client khi đang thi)
const findById = async (id) => {
  const { rows } = await query(
    `SELECT
       q.*,
       s.name  AS subject_name,
       s.grade AS subject_grade,
       u.full_name AS created_by_name
     FROM questions q
     JOIN subjects s ON q.subject_id = s.id
     JOIN users    u ON q.created_by  = u.id
     WHERE q.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Tạo câu hỏi mới
// options và correct_answer truyền vào là JS object — pg tự serialize thành JSONB
const create = async ({ subject_id, created_by, type, content, options, correct_answer, difficulty }) => {
  const { rows } = await query(
    `INSERT INTO questions
       (subject_id, created_by, type, content, options, correct_answer, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      subject_id,
      created_by,
      type,
      content,
      options ? JSON.stringify(options) : null,
      JSON.stringify(correct_answer),
      difficulty,
    ]
  );
  return rows[0];
};

// Cập nhật câu hỏi — chỉ cho phép khi chưa được phê duyệt
const update = async (id, { content, options, correct_answer, difficulty }) => {
  const { rows } = await query(
    `UPDATE questions
     SET content=$1, options=$2, correct_answer=$3, difficulty=$4,
         is_approved=FALSE   -- sửa nội dung => reset phê duyệt, cần duyệt lại
     WHERE id=$5 AND is_approved=FALSE
     RETURNING *`,
    [
      content,
      options ? JSON.stringify(options) : null,
      JSON.stringify(correct_answer),
      difficulty,
      id,
    ]
  );
  return rows[0] || null;
};

// Phê duyệt câu hỏi — chỉ tổ trưởng
const approve = async (id, approved_by_id) => {
  const { rows } = await query(
    `UPDATE questions
     SET is_approved=TRUE, approved_by=$2, approved_at=NOW()
     WHERE id=$1
     RETURNING id, content, is_approved, approved_by, approved_at`,
    [id, approved_by_id]
  );
  return rows[0] || null;
};

// Từ chối / thu hồi phê duyệt — tổ trưởng hoặc admin
const reject = async (id) => {
  const { rows } = await query(
    `UPDATE questions
     SET is_approved=FALSE, approved_by=NULL, approved_at=NULL
     WHERE id=$1
     RETURNING id, content, is_approved`,
    [id]
  );
  return rows[0] || null;
};

// Xóa câu hỏi — chỉ xóa được khi chưa phê duyệt và chưa nằm trong đề nào
const remove = async (id) => {
  // Kiểm tra đã nằm trong đề nào chưa
  const { rows: inExam } = await query(
    'SELECT id FROM exam_questions WHERE question_id=$1 LIMIT 1',
    [id]
  );
  if (inExam.length > 0) {
    throw new Error('Không thể xóa câu hỏi đã được đưa vào đề thi');
  }

  const { rows } = await query(
    `DELETE FROM questions WHERE id=$1 AND is_approved=FALSE
     RETURNING id`,
    [id]
  );
  if (!rows[0]) {
    throw new Error('Không thể xóa câu hỏi đã được phê duyệt');
  }
  return rows[0];
};

// Lấy ngẫu nhiên câu hỏi theo bộ lọc — dùng khi tạo đề tự động
const findRandom = async ({ subject_id, difficulty, type, topic_filter, exclude_ids = [], limit = 10 }) => {
  const params = [subject_id, limit];
  let sql = `
    SELECT id, type, content, options, difficulty
    FROM questions
    WHERE subject_id=$1 AND is_approved=TRUE
  `;

  if (difficulty)    { params.push(difficulty);    sql += ` AND difficulty=$${params.length}`; }
  if (type)          { params.push(type);           sql += ` AND type=$${params.length}`; }
  // topic_filter: lọc theo từ khóa chủ đề trong nội dung câu hỏi (ILIKE)
  if (topic_filter)  { params.push(`%${topic_filter}%`); sql += ` AND content ILIKE $${params.length}`; }

  // Loại trừ các câu đã chọn trước đó
  if (exclude_ids.length > 0) {
    params.push(exclude_ids);
    sql += ` AND id <> ALL($${params.length})`;
  }

  sql += ` ORDER BY RANDOM() LIMIT $2`;

  const { rows } = await query(sql, params);
  return rows;
};

// Kiểm tra câu hỏi trùng lặp trong cùng môn học
// So sánh nội dung sau khi TRIM + chuẩn hóa khoảng trắng, không phân biệt hoa/thường
// So sánh cả mảng options (nếu có) thông qua jsonb để tránh báo trùng các câu hỏi chung chung như "Chọn đáp án đúng"
// exclude_id: id câu hỏi hiện tại (dùng khi sửa — không tự so sánh với chính nó)
const findDuplicate = async (subject_id, content, options_str, exclude_id = null) => {
  // Cần REGEXP_REPLACE để chuẩn hóa khoảng trắng trong nội dung
  // Hai câu hỏi coi là trùng nếu lower(trim(content)) giống hệt nhau VÀ options giống nhau
  let sql = `
    SELECT
      q.id, q.content, q.type, q.difficulty,
      u.full_name AS created_by_name,
      s.name AS subject_name,
      q.is_approved
    FROM questions q
    JOIN users    u ON q.created_by  = u.id
    JOIN subjects s ON q.subject_id  = s.id
    WHERE q.subject_id = $1
      AND LOWER(REGEXP_REPLACE(TRIM(q.content), '\\s+', ' ', 'g'))
        = LOWER(REGEXP_REPLACE(TRIM($2), '\\s+', ' ', 'g'))
      AND COALESCE(q.options::jsonb, '[]'::jsonb) = COALESCE($3::jsonb, '[]'::jsonb)
  `;
  const params = [subject_id, content, options_str];

  if (exclude_id) {
    params.push(exclude_id);
    sql += ` AND q.id <> $${params.length}`;
  }

  sql += ' LIMIT 1';
  const { rows } = await query(sql, params);
  return rows[0] || null; // null nếu không trùng
};

module.exports = { findAll, findById, create, update, approve, reject, remove, findRandom, findDuplicate };

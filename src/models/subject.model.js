// models/subject.model.js
// Tất cả query liên quan đến bảng subjects

const { query } = require('../config/db');

// Lấy tất cả môn học — lọc theo grade nếu có
const findAll = async ({ grade } = {}) => {
  let sql = `SELECT s.id, s.name, s.grade, s.category, s.description, s.created_at,
                    COUNT(q.id)::int AS question_count
             FROM subjects s
             LEFT JOIN questions q ON s.id = q.subject_id
             WHERE TRUE`;
  const params = [];

  if (grade) {
    params.push(grade);
    sql += ` AND s.grade = $${params.length}`;
  }
  sql += ' GROUP BY s.id, s.name, s.grade, s.category, s.description, s.created_at ORDER BY s.grade, s.name';

  const { rows } = await query(sql, params);
  return rows;
};

// Tìm môn học theo id
const findById = async (id) => {
  const { rows } = await query(
    'SELECT * FROM subjects WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

// Tạo môn học mới
const create = async ({ name, grade, category, description }) => {
  const { rows } = await query(
    `INSERT INTO subjects (name, grade, category, description)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, grade, category || 'bat_buoc', description || null]
  );
  return rows[0];
};

// Cập nhật môn học
const update = async (id, { name, grade, category, description }) => {
  const { rows } = await query(
    `UPDATE subjects SET name=$1, grade=$2, category=$3, description=$4
     WHERE id=$5 RETURNING *`,
    [name, grade, category || 'bat_buoc', description || null, id]
  );
  return rows[0] || null;
};

// Xóa môn học — chỉ được xóa nếu không có câu hỏi nào thuộc môn
const remove = async (id) => {
  const { rows: questions } = await query(
    'SELECT id FROM questions WHERE subject_id = $1 LIMIT 1',
    [id]
  );
  if (questions.length > 0) {
    throw new Error('Không thể xóa môn học còn câu hỏi');
  }

  const { rows } = await query(
    'DELETE FROM subjects WHERE id = $1 RETURNING id',
    [id]
  );
  return rows[0] || null;
};

module.exports = { findAll, findById, create, update, remove };

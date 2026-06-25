// models/class.model.js
// Tất cả query liên quan đến bảng classes

const { query } = require('../config/db');

// Lấy tất cả lớp — có thể lọc theo grade và school_year
const findAll = async ({ grade, school_year } = {}) => {
  let sql = `SELECT c.id, c.name, c.grade, c.school_year, c.created_at, c.homeroom_teacher_id,
                    t.full_name AS homeroom_teacher_name,
                    COUNT(u.id)::int AS student_count
             FROM classes c
             LEFT JOIN users u ON u.class_id = c.id
             LEFT JOIN users t ON c.homeroom_teacher_id = t.id
             WHERE TRUE`;
  const params = [];

  if (grade) {
    params.push(grade);
    sql += ` AND c.grade = $${params.length}`;
  }
  if (school_year) {
    params.push(school_year);
    sql += ` AND c.school_year = $${params.length}`;
  }
  sql += ' GROUP BY c.id, t.full_name ORDER BY c.grade, c.name';

  const { rows } = await query(sql, params);
  return rows;
};

// Tìm lớp theo id
const findById = async (id) => {
  const { rows } = await query(
    'SELECT * FROM classes WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

// Tạo lớp mới
const create = async ({ name, grade, school_year, homeroom_teacher_id }) => {
  const { rows } = await query(
    `INSERT INTO classes (name, grade, school_year, homeroom_teacher_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, grade, school_year, homeroom_teacher_id || null]
  );
  return rows[0];
};

// Cập nhật lớp
const update = async (id, { name, grade, school_year, homeroom_teacher_id }) => {
  const { rows } = await query(
    `UPDATE classes SET name=$1, grade=$2, school_year=$3, homeroom_teacher_id=$4
     WHERE id=$5 RETURNING *`,
    [name, grade, school_year, homeroom_teacher_id || null, id]
  );
  return rows[0] || null;
};

const findStudents = async (classId) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.role, u.class_id, u.is_active, u.created_at
     FROM users u
     WHERE u.class_id = $1 AND u.role = 'student'
     ORDER BY u.full_name`,
    [classId]
  );
  return rows;
};

// Tìm lớp mà giáo viên làm chủ nhiệm
const findByHomeroomTeacher = async (teacherId) => {
  const { rows } = await query(
    `SELECT * FROM classes WHERE homeroom_teacher_id = $1`,
    [teacherId]
  );
  return rows;
};

// Xóa lớp — chỉ được xóa nếu không còn học sinh nào thuộc lớp đó
const remove = async (id) => {
  // Kiểm tra còn học sinh trong lớp không
  const { rows: students } = await query(
    'SELECT id FROM users WHERE class_id = $1 LIMIT 1',
    [id]
  );
  if (students.length > 0) {
    throw new Error('Không thể xóa lớp còn học sinh');
  }

  // Kiểm tra còn lịch thi
  const { rows: schedules } = await query(
    'SELECT id FROM exam_schedules WHERE class_id = $1 LIMIT 1',
    [id]
  );
  if (schedules.length > 0) {
    throw new Error('Không thể xóa lớp vì đang có lịch thi gắn với lớp này');
  }

  const { rows } = await query(
    'DELETE FROM classes WHERE id = $1 RETURNING id',
    [id]
  );
  return rows[0] || null;
};

module.exports = { findAll, findById, create, update, remove, findStudents, findByHomeroomTeacher };

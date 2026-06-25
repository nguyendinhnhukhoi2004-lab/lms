// src/models/teacher_subject.model.js
// Phân công giáo viên - môn học và tổ trưởng - môn học

const { query } = require('../config/db');

// ── TEACHER SUBJECTS ─────────────────────────────────────────────

// Lấy danh sách môn học được phân công của 1 giáo viên
const findByTeacher = async (teacher_id) => {
  const { rows } = await query(
    `SELECT ts.id, ts.subject_id, s.name AS subject_name, s.grade
     FROM teacher_subjects ts
     JOIN subjects s ON ts.subject_id = s.id
     WHERE ts.teacher_id = $1
     ORDER BY s.name, s.grade`,
    [teacher_id]
  );
  return rows;
};

// Lấy danh sách subject_id được phân công của 1 giáo viên (dùng để filter)
const findSubjectIdsByTeacher = async (teacher_id) => {
  const { rows } = await query(
    `SELECT subject_id FROM teacher_subjects WHERE teacher_id = $1`,
    [teacher_id]
  );
  return rows.map(r => r.subject_id);
};

// Lấy tất cả phân công (admin xem toàn bộ)
const findAll = async () => {
  const { rows } = await query(
    `SELECT ts.id, ts.teacher_id, ts.subject_id,
            u.full_name AS teacher_name, u.email AS teacher_email,
            s.name AS subject_name, s.grade
     FROM teacher_subjects ts
     JOIN users    u ON ts.teacher_id = u.id
     JOIN subjects s ON ts.subject_id = s.id
     ORDER BY u.full_name, s.name, s.grade`
  );
  return rows;
};

// Gán môn học cho giáo viên (upsert)
const assign = async (teacher_id, subject_ids) => {
  const client = require('../config/db').getClient
    ? await require('../config/db').getClient()
    : null;

  // Nếu không có getClient, dùng query thông thường
  if (!client) {
    for (const subject_id of subject_ids) {
      await query(
        `INSERT INTO teacher_subjects (teacher_id, subject_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [teacher_id, subject_id]
      );
    }
    return findByTeacher(teacher_id);
  }

  try {
    await client.query('BEGIN');
    // Xóa phân công cũ, thêm mới
    await client.query(
      'DELETE FROM teacher_subjects WHERE teacher_id = $1',
      [teacher_id]
    );
    for (const subject_id of subject_ids) {
      await client.query(
        `INSERT INTO teacher_subjects (teacher_id, subject_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [teacher_id, subject_id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return findByTeacher(teacher_id);
};

// Xóa 1 phân công
const remove = async (teacher_id, subject_id) => {
  await query(
    'DELETE FROM teacher_subjects WHERE teacher_id=$1 AND subject_id=$2',
    [teacher_id, subject_id]
  );
};

// ── HEAD SUBJECTS ─────────────────────────────────────────────────

// Lấy danh sách môn phụ trách của tổ trưởng
const findByHead = async (head_id) => {
  const { rows } = await query(
    `SELECT id, subject_name FROM head_subjects WHERE head_id=$1 ORDER BY subject_name`,
    [head_id]
  );
  return rows;
};

// Lấy danh sách tên môn của tổ trưởng (dùng để filter)
const findSubjectNamesByHead = async (head_id) => {
  const { rows } = await query(
    `SELECT subject_name FROM head_subjects WHERE head_id=$1`,
    [head_id]
  );
  return rows.map(r => r.subject_name);
};

// Lấy tất cả phân công của các tổ trưởng (dùng cho admin view)
const findAllHeads = async () => {
  const { rows } = await query(
    `SELECT hs.id, hs.head_id, hs.subject_name,
            u.full_name AS head_name, u.email AS head_email
     FROM head_subjects hs
     JOIN users u ON hs.head_id = u.id
     ORDER BY u.full_name, hs.subject_name`
  );
  return rows;
};

// Gán môn cho tổ trưởng
const assignHead = async (head_id, subject_names) => {
  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM head_subjects WHERE head_id=$1', [head_id]);
    for (const subject_name of subject_names) {
      await client.query(
        `INSERT INTO head_subjects (head_id, subject_name)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [head_id, subject_name.trim()]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return findByHead(head_id);
};

// ── HELPER ────────────────────────────────────────────────────────

// Kiểm tra xem user có quyền tác động lên môn học này không
const checkAccess = async (user_id, role, subject_id) => {
  if (role === 'admin') return true;
  if (role === 'teacher') {
    const assigned = await findSubjectIdsByTeacher(user_id);
    return assigned.includes(subject_id);
  }
  if (role === 'department_head') {
    const headSubjects = await findSubjectNamesByHead(user_id);
    if (headSubjects.length === 0) return false;
    const { rows } = await query(`SELECT id FROM subjects WHERE name = ANY($1)`, [headSubjects]);
    const allowedIds = rows.map(r => r.id);
    return allowedIds.includes(subject_id);
  }
  return false;
};

module.exports = {
  findByTeacher,
  findSubjectIdsByTeacher,
  findAll,
  assign,
  remove,

  findByHead,
  findSubjectNamesByHead,
  findAllHeads,
  assignHead,

  checkAccess,
};

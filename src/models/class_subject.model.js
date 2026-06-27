// src/models/class_subject.model.js
const { query } = require('../config/db');

// Lấy toàn bộ phân công
const findAll = async () => {
  const { rows } = await query(
    `SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id,
            c.name AS class_name, c.grade, c.school_year,
            s.name AS subject_name
     FROM class_subjects cs
     JOIN classes c ON cs.class_id = c.id
     JOIN subjects s ON cs.subject_id = s.id
     ORDER BY c.grade, c.name, s.name`
  );
  return rows;
};

// Lấy danh sách môn học và giáo viên của một lớp
const getByClass = async (class_id) => {
  const { rows } = await query(
    `SELECT cs.id, cs.subject_id, cs.teacher_id,
            s.name AS subject_name,
            u.full_name AS teacher_name, u.email AS teacher_email
     FROM class_subjects cs
     JOIN subjects s ON cs.subject_id = s.id
     LEFT JOIN users u ON cs.teacher_id = u.id
     WHERE cs.class_id = $1
     ORDER BY s.name`,
    [class_id]
  );
  return rows;
};

// Phân công giáo viên cho các môn của một lớp
const assignSubjectsToClass = async (class_id, assignments) => {
  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');
    
    // Xóa phân công cũ của lớp
    await client.query('DELETE FROM class_subjects WHERE class_id = $1', [class_id]);

    // Thêm phân công mới
    for (const a of assignments) {
      if (a.teacher_id) {
        await client.query(
          `INSERT INTO class_subjects (class_id, subject_id, teacher_id)
           VALUES ($1, $2, $3)`,
          [class_id, a.subject_id, a.teacher_id]
        );
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Lấy danh sách lớp và môn học mà một giáo viên đang dạy
const getClassesByTeacher = async (teacher_id) => {
  const { rows } = await query(
    `SELECT cs.id, cs.class_id, cs.subject_id,
            c.name AS class_name, c.grade, c.school_year,
            s.name AS subject_name
     FROM class_subjects cs
     JOIN classes c ON cs.class_id = c.id
     JOIN subjects s ON cs.subject_id = s.id
     WHERE cs.teacher_id = $1
     ORDER BY c.grade, c.name, s.name`,
    [teacher_id]
  );
  return rows;
};

// Phân công môn và lớp cho giáo viên
const assignClassesToTeacher = async (teacher_id, assignments, client = null) => {
  const dbClient = client || await require('../config/db').getClient();
  const shouldRelease = !client;
  
  try {
    if (shouldRelease) await dbClient.query('BEGIN');
    
    // Xóa phân công cũ của giáo viên
    await dbClient.query('DELETE FROM class_subjects WHERE teacher_id = $1', [teacher_id]);

    // Thêm phân công mới
    for (const a of assignments) {
      const { subject_id, class_ids } = a;
      if (subject_id && Array.isArray(class_ids)) {
        for (const class_id of class_ids) {
          await dbClient.query(
            `INSERT INTO class_subjects (class_id, subject_id, teacher_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (class_id, subject_id) DO UPDATE SET teacher_id = EXCLUDED.teacher_id`,
            [class_id, subject_id, teacher_id]
          );
        }
      }
    }

    if (shouldRelease) await dbClient.query('COMMIT');
  } catch (error) {
    if (shouldRelease) await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldRelease) dbClient.release();
  }
};

module.exports = {
  findAll,
  getByClass,
  assignSubjectsToClass,
  getClassesByTeacher,
  assignClassesToTeacher
};

const { query } = require('../config/db');

// Lấy điểm của một môn trong lớp hành chính (cho GVBM)
const getClassSubjectGrades = async (classSubjectId) => {
  const { rows } = await query(
    `SELECT u.id AS student_id, u.full_name, 
            e.id AS exam_id, e.title AS exam_title, e.exam_type,
            r.total_score, r.created_at
     FROM class_subjects cs
     JOIN users u ON u.class_id = cs.class_id AND u.role = 'student'
     JOIN exams e ON e.subject_id = cs.subject_id
     JOIN exam_schedules es ON es.exam_id = e.id
     JOIN submissions s ON s.schedule_id = es.id AND s.student_id = u.id
     JOIN results r ON r.submission_id = s.id
     WHERE cs.id = $1
     ORDER BY u.full_name, e.created_at`,
    [classSubjectId]
  );
  return rows;
};

// Lấy bảng điểm tổng hợp của một lớp hành chính (cho GVCN)
const getHomeroomClassGrades = async (classId) => {
  const { rows } = await query(
    `SELECT u.id AS student_id, u.full_name, 
            sub.id AS subject_id, sub.name AS subject_name,
            e.id AS exam_id, e.title AS exam_title, e.exam_type,
            r.total_score
     FROM users u
     JOIN student_subjects ss ON ss.student_id = u.id
     JOIN subjects sub ON sub.id = ss.subject_id
     LEFT JOIN exams e ON e.subject_id = sub.id
     LEFT JOIN exam_schedules es ON es.exam_id = e.id
     LEFT JOIN submissions s ON s.schedule_id = es.id AND s.student_id = u.id
     LEFT JOIN results r ON r.submission_id = s.id
     WHERE u.class_id = $1 AND u.role = 'student'
     ORDER BY u.full_name, sub.name, e.created_at`,
    [classId]
  );
  return rows;
};

// Hàm lấy tất cả học sinh và điểm các môn của lớp hành chính (Pivot chuẩn bị ở Backend)
const getHomeroomGradeMatrix = async (classId) => {
  const rawGrades = await getHomeroomClassGrades(classId);
  
  // Pivot data
  const matrix = {};
  const subjects = new Set();
  
  rawGrades.forEach(row => {
    if (!matrix[row.student_id]) {
      matrix[row.student_id] = {
        student_id: row.student_id,
        full_name: row.full_name,
        scores: {}
      };
    }
    
    subjects.add(row.subject_name);
    
    if (!matrix[row.student_id].scores[row.subject_name]) {
      matrix[row.student_id].scores[row.subject_name] = [];
    }
    
    if (row.total_score !== null) {
      matrix[row.student_id].scores[row.subject_name].push({
        exam_id: row.exam_id,
        exam_title: row.exam_title,
        exam_type: row.exam_type,
        score: row.total_score
      });
    }
  });

  return {
    students: Object.values(matrix),
    subjects: Array.from(subjects).sort()
  };
};

module.exports = {
  getClassSubjectGrades,
  getHomeroomClassGrades,
  getHomeroomGradeMatrix
};

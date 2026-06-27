// src/controllers/teacher_subjects.controller.js
// Phân công giáo viên - môn học và tổ trưởng - môn học

const TeacherSubjectModel = require('../models/teacher_subject.model');
const { query }           = require('../config/db');

// GET /api/teacher-subjects
// Admin: xem tất cả phân công
const getAll = async (req, res) => {
  try {
    const assignments = await TeacherSubjectModel.findAll();
    const headAssignments = await TeacherSubjectModel.findAllHeads();
    return res.status(200).json({ assignments, headAssignments });
  } catch (err) {
    console.error('getAll teacher-subjects error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/teacher-subjects/teacher/:id
// Xem phân công của 1 giáo viên
const getByTeacher = async (req, res) => {
  try {
    const subjects = await TeacherSubjectModel.findByTeacher(req.params.id);
    return res.status(200).json({ subjects });
  } catch (err) {
    console.error('getByTeacher error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/teacher-subjects/teacher/:id
// Admin gán danh sách môn học cho giáo viên (ghi đè toàn bộ)
// Body: { subject_ids: ["uuid1", "uuid2", ...] }
const assignToTeacher = async (req, res) => {
  try {
    const { subject_ids = [] } = req.body;
    const saved = await TeacherSubjectModel.assign(req.params.id, subject_ids);
    return res.status(200).json({
      message: `Đã phân công ${saved.length} môn học cho giáo viên`,
      subjects: saved,
    });
  } catch (err) {
    console.error('assignToTeacher error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/teacher-subjects/teacher/:id/full-assign
// Phân công toàn diện (môn giảng dạy, lớp, môn tổ trưởng) cho giáo viên
// Body: { assignments: [{ subject_id, class_ids: [] }], head_subjects: ["Toán"] }
const fullAssign = async (req, res) => {
  const ClassSubjectModel = require('../models/class_subject.model');
  const dbClient = await require('../config/db').getClient();

  try {
    const { assignments = [], head_subjects } = req.body;
    const teacher_id = req.params.id;

    await dbClient.query('BEGIN');

    // 1. Phân công môn giảng dạy
    const subject_ids = assignments.map(a => a.subject_id);
    await TeacherSubjectModel.assign(teacher_id, subject_ids, dbClient);

    // 2. Phân công lớp giảng dạy
    await ClassSubjectModel.assignClassesToTeacher(teacher_id, assignments, dbClient);

    // 3. Phân công môn tổ trưởng (nếu có truyền lên)
    if (Array.isArray(head_subjects)) {
      await TeacherSubjectModel.assignHead(teacher_id, head_subjects, dbClient);
    }

    await dbClient.query('COMMIT');
    return res.status(200).json({ message: 'Phân công toàn diện thành công' });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('fullAssign error:', err);
    return res.status(500).json({ message: 'Lỗi server khi phân công toàn diện' });
  } finally {
    dbClient.release();
  }
};

// GET /api/teacher-subjects/head/:id
// Xem môn phụ trách của tổ trưởng
const getByHead = async (req, res) => {
  try {
    const subjects = await TeacherSubjectModel.findByHead(req.params.id);
    return res.status(200).json({ subjects });
  } catch (err) {
    console.error('getByHead error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/teacher-subjects/head/:id
// Admin gán môn phụ trách cho tổ trưởng (ghi đè toàn bộ)
// Body: { subject_names: ["Toán", "Vật lý"] }
const assignToHead = async (req, res) => {
  try {
    const { subject_names = [] } = req.body;
    const saved = await TeacherSubjectModel.assignHead(req.params.id, subject_names);
    return res.status(200).json({
      message: `Đã phân công ${saved.length} môn học cho tổ trưởng`,
      subjects: saved,
    });
  } catch (err) {
    console.error('assignToHead error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/teacher-subjects/my-subjects
// Giáo viên / tổ trưởng xem môn học của chính mình
const getMySubjects = async (req, res) => {
  try {
    if (req.user.role === 'teacher') {
      const subjects = await TeacherSubjectModel.findByTeacher(req.user.id);
      return res.status(200).json({ subjects });
    }
    if (req.user.role === 'department_head') {
      const subjects = await TeacherSubjectModel.findByHead(req.user.id);
      return res.status(200).json({ subjects });
    }
    return res.status(403).json({ message: 'Không có quyền' });
  } catch (err) {
    console.error('getMySubjects error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/teacher-subjects/subject-names
// Lấy danh sách tên môn duy nhất (dùng cho dropdown phân công tổ trưởng)
const getSubjectNames = async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT name FROM subjects ORDER BY name`
    );
    return res.status(200).json({ names: rows.map(r => r.name) });
  } catch (err) {
    console.error('getSubjectNames error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = {
  getAll, getByTeacher, assignToTeacher, fullAssign,
  getByHead, assignToHead,
  getMySubjects, getSubjectNames,
};

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
  getAll, getByTeacher, assignToTeacher,
  getByHead, assignToHead,
  getMySubjects, getSubjectNames,
};

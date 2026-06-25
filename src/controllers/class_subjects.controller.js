// src/controllers/class_subjects.controller.js
const classSubjectModel = require('../models/class_subject.model');

exports.getAll = async (req, res) => {
  try {
    const subjects = await classSubjectModel.findAll();
    res.json(subjects);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách phân công:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Lấy phân công môn học của 1 lớp
exports.getByClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    const subjects = await classSubjectModel.getByClass(class_id);
    res.json(subjects);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách môn học của lớp:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Cập nhật phân công giáo viên cho các môn của lớp
exports.assignToClass = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { assignments } = req.body; // [{ subject_id, teacher_id }]
    
    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).json({ message: 'Dữ liệu phân công không hợp lệ' });
    }

    await classSubjectModel.assignSubjectsToClass(class_id, assignments);
    res.json({ message: 'Phân công môn học thành công' });
  } catch (error) {
    console.error('Lỗi khi phân công môn học cho lớp:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Lấy danh sách lớp/môn mà giáo viên dạy
exports.getTeacherClasses = async (req, res) => {
  try {
    const { teacher_id } = req.params;
    const classes = await classSubjectModel.getClassesByTeacher(teacher_id);
    res.json(classes);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách lớp của giáo viên:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

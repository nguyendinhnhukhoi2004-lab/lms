// controllers/classes.controller.js

const { validationResult } = require('express-validator');
const ClassModel = require('../models/class.model');

// GET /api/classes?grade=10&school_year=2025-2026
const getAll = async (req, res) => {
  try {
    const { grade, school_year } = req.query;
    const classes = await ClassModel.findAll({
      grade: grade ? parseInt(grade) : undefined,
      school_year,
    });
    return res.status(200).json({ classes });
  } catch (err) {
    console.error('getAll classes error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/classes/:id
const getById = async (req, res) => {
  try {
    const cls = await ClassModel.findById(req.params.id);
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp học' });
    return res.status(200).json({ class: cls });
  } catch (err) {
    console.error('getById class error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/classes/:id/students
const getStudents = async (req, res) => {
  try {
    const students = await ClassModel.findStudents(req.params.id);
    return res.status(200).json({ students });
  } catch (err) {
    console.error('getStudents class error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/classes
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const cls = await ClassModel.create(req.body);
    return res.status(201).json({ message: 'Tạo lớp học thành công', class: cls });
  } catch (err) {
    // Bắt lỗi trùng tên lớp trong cùng năm học (nếu có unique constraint)
    console.error('create class error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/classes/:id
const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const cls = await ClassModel.update(req.params.id, req.body);
    if (!cls) return res.status(404).json({ message: 'Không tìm thấy lớp học' });
    return res.status(200).json({ message: 'Cập nhật thành công', class: cls });
  } catch (err) {
    console.error('update class error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// DELETE /api/classes/:id
const remove = async (req, res) => {
  try {
    await ClassModel.remove(req.params.id);
    return res.status(200).json({ message: 'Xóa lớp học thành công' });
  } catch (err) {
    // Bắt lỗi nghiệp vụ từ model (còn học sinh)
    if (err.message.includes('Không thể xóa')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('remove class error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { getAll, getById, getStudents, create, update, remove };

// controllers/subjects.controller.js

const { validationResult } = require('express-validator');
const SubjectModel = require('../models/subject.model');

// GET /api/subjects?grade=10
const getAll = async (req, res) => {
  try {
    const { grade } = req.query;
    const subjects = await SubjectModel.findAll({
      grade: grade ? parseInt(grade) : undefined,
    });
    return res.status(200).json({ subjects });
  } catch (err) {
    console.error('getAll subjects error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/subjects/:id
const getById = async (req, res) => {
  try {
    const subject = await SubjectModel.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Không tìm thấy môn học' });
    return res.status(200).json({ subject });
  } catch (err) {
    console.error('getById subject error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/subjects
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const subject = await SubjectModel.create(req.body);
    return res.status(201).json({ message: 'Tạo môn học thành công', subject });
  } catch (err) {
    console.error('create subject error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/subjects/:id
const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const subject = await SubjectModel.update(req.params.id, req.body);
    if (!subject) return res.status(404).json({ message: 'Không tìm thấy môn học' });
    return res.status(200).json({ message: 'Cập nhật thành công', subject });
  } catch (err) {
    console.error('update subject error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// DELETE /api/subjects/:id
const remove = async (req, res) => {
  try {
    await SubjectModel.remove(req.params.id);
    return res.status(200).json({ message: 'Xóa môn học thành công' });
  } catch (err) {
    if (err.message.includes('Không thể xóa')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('remove subject error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { getAll, getById, create, update, remove };

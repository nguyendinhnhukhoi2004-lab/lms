// controllers/questions.controller.js
// Xử lý toàn bộ nghiệp vụ ngân hàng câu hỏi:
//   - CRUD câu hỏi (3 dạng: MCQ, T/F, Essay)
//   - Luồng phê duyệt: giáo viên tạo → tổ trưởng duyệt

const { validationResult } = require('express-validator');
const QuestionModel       = require('../models/question.model');
const TeacherSubjectModel = require('../models/teacher_subject.model');
const { validateQuestion } = require('../utils/questionValidator');

// GET /api/questions
// Query params: subject_id, type, difficulty, is_approved, page, limit
const getAll = async (req, res) => {
  try {
    const {
      subject_id, type, difficulty, page = 1, limit = 20,
    } = req.query;

    // Giáo viên chỉ thấy câu hỏi của mình + câu đã duyệt của người khác
    // Admin và tổ trưởng thấy tất cả
    let is_approved = req.query.is_approved;
    let created_by;
    let subject_ids = undefined;

    if (req.user.role === 'teacher') {
      created_by = req.user.id;
      // Lấy môn học được phân công — giáo viên chỉ thấy câu hỏi trong môn đó
      const assigned = await TeacherSubjectModel.findSubjectIdsByTeacher(req.user.id);
      if (assigned.length === 0) return res.status(200).json({ questions: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      subject_ids = assigned;
    } else if (req.user.role === 'student') {
      return res.status(403).json({ message: 'Học sinh không có quyền xem ngân hàng câu hỏi' });
    } else if (req.user.role === 'department_head') {
      // Lấy các môn được phân công dạy (với tư cách giáo viên)
      const assigned = await TeacherSubjectModel.findSubjectIdsByTeacher(req.user.id);
      
      // Lấy các môn là tổ trưởng
      const headSubjects = await TeacherSubjectModel.findSubjectNamesByHead(req.user.id);
      
      const { query } = require('../config/db');
      let allowedIds = [...assigned];

      if (headSubjects.length > 0) {
        const conditions = headSubjects.map((name, i) => `name ILIKE $${i + 1}`).join(' OR ');
        const params = headSubjects.map(name => `${name.trim()}%`);
        const { rows } = await query(`SELECT id FROM subjects WHERE ${conditions}`, params);
        allowedIds = [...new Set([...allowedIds, ...rows.map(r => r.id)])];
      }
      
      if (allowedIds.length === 0) return res.status(200).json({ questions: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      subject_ids = allowedIds;
    }

    const result = await QuestionModel.findAll({
      subject_id,
      subject_ids,
      type,
      difficulty,
      is_approved: is_approved !== undefined ? is_approved === 'true' : undefined,
      created_by,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('getAll questions error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/questions/:id
const getById = async (req, res) => {
  try {
    const question = await QuestionModel.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, question.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xem câu hỏi của môn học này' });
    }

    // Giáo viên chỉ được xem câu hỏi của mình hoặc câu đã duyệt
    if (req.user.role === 'teacher'
      && question.created_by !== req.user.id
      && !question.is_approved) {
      return res.status(403).json({ message: 'Bạn không có quyền xem câu hỏi này' });
    }

    // Ẩn correct_answer nếu không cần thiết (tùy chính sách — hiện tại trả về)
    return res.status(200).json({ question });
  } catch (err) {
    console.error('getById question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/questions
// Body: { subject_id, type, content, options, correct_answer, difficulty }
const create = async (req, res) => {
  // Validate các trường cơ bản từ express-validator (khai báo trong route)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { subject_id, type, content, options, correct_answer, difficulty } = req.body;

  const structureErrors = validateQuestion(type, options, correct_answer);
  if (structureErrors.length > 0) {
    return res.status(400).json({ errors: structureErrors });
  }

  if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, subject_id))) {
    return res.status(403).json({ message: 'Bạn không có quyền tạo câu hỏi cho môn học này' });
  }

  try {
    // Kiểm tra trùng lặp nội dung (và đáp án) trong cùng môn học
    const optionsStr = options ? JSON.stringify(options) : null;
    const duplicate = await QuestionModel.findDuplicate(subject_id, content, optionsStr);
    if (duplicate) {
      return res.status(409).json({
        message: `Nội dung câu hỏi này đã tồn tại trong ngân hàng câu hỏi môn ${duplicate.subject_name}.`,
        duplicate: {
          id: duplicate.id,
          content: duplicate.content,
          type: duplicate.type,
          difficulty: duplicate.difficulty,
          created_by_name: duplicate.created_by_name,
          is_approved: duplicate.is_approved,
        },
      });
    }

    const question = await QuestionModel.create({
      subject_id,
      created_by: req.user.id, // lấy từ JWT — không tin body
      type,
      content,
      options: options || null,
      correct_answer,
      difficulty,
    });

    return res.status(201).json({
      message: 'Tạo câu hỏi thành công. Đang chờ tổ trưởng phê duyệt.',
      question,
    });
  } catch (err) {
    console.error('create question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/questions/:id
// Chỉ sửa được câu hỏi chưa phê duyệt và do chính mình tạo
const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // Lấy câu hỏi gốc để kiểm tra quyền
    const existing = await QuestionModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, existing.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa câu hỏi của môn học này' });
    }

    // Chỉ người tạo hoặc admin mới được sửa
    if (req.user.role === 'teacher' && existing.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn chỉ có thể sửa câu hỏi do mình tạo' });
    }

    const { content, options, correct_answer, difficulty } = req.body;

    // Validate lại cấu trúc JSONB (type không được đổi)
    const structureErrors = validateQuestion(existing.type, options, correct_answer);
    if (structureErrors.length > 0) {
      return res.status(400).json({ errors: structureErrors });
    }

    // Kiểm tra trùng lặp (bỏ qua chính câu hỏi đang sửa, so sánh cả đáp án)
    const optionsStr = options ? JSON.stringify(options) : null;
    const duplicate = await QuestionModel.findDuplicate(existing.subject_id, content, optionsStr, req.params.id);
    if (duplicate) {
      return res.status(409).json({
        message: `Nội dung câu hỏi này đã tồn tại trong ngân hàng câu hỏi môn ${duplicate.subject_name}.`,
        duplicate: {
          id: duplicate.id,
          content: duplicate.content,
          type: duplicate.type,
          difficulty: duplicate.difficulty,
          created_by_name: duplicate.created_by_name,
          is_approved: duplicate.is_approved,
        },
      });
    }

    const question = await QuestionModel.update(req.params.id, {
      content,
      options: options || null,
      correct_answer,
      difficulty,
    });

    if (!question) {
      return res.status(409).json({ message: 'Không thể sửa câu hỏi đã được phê duyệt' });
    }

    return res.status(200).json({ message: 'Cập nhật thành công. Cần phê duyệt lại.', question });
  } catch (err) {
    console.error('update question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/questions/:id/approve
// Phê duyệt câu hỏi — chỉ tổ trưởng (department_head)
const approve = async (req, res) => {
  try {
    const existing = await QuestionModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, existing.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền duyệt câu hỏi của môn học này' });
    }

    const question = await QuestionModel.approve(req.params.id, req.user.id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }
    return res.status(200).json({ message: 'Đã phê duyệt câu hỏi', question });
  } catch (err) {
    console.error('approve question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/questions/:id/reject
// Từ chối / thu hồi phê duyệt — tổ trưởng hoặc admin
const reject = async (req, res) => {
  try {
    const existing = await QuestionModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, existing.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền từ chối câu hỏi của môn học này' });
    }

    const question = await QuestionModel.reject(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }
    return res.status(200).json({ message: 'Đã từ chối / thu hồi phê duyệt', question });
  } catch (err) {
    console.error('reject question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// DELETE /api/questions/:id
// Chỉ xóa được câu hỏi chưa phê duyệt và chưa nằm trong đề
const remove = async (req, res) => {
  try {
    const existing = await QuestionModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Không tìm thấy câu hỏi' });
    }

    if (!(await TeacherSubjectModel.checkAccess(req.user.id, req.user.role, existing.subject_id))) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa câu hỏi của môn học này' });
    }

    if (req.user.role === 'teacher' && existing.created_by !== req.user.id) {
      return res.status(403).json({ message: 'Bạn chỉ có thể xóa câu hỏi do mình tạo' });
    }

    await QuestionModel.remove(req.params.id);
    return res.status(200).json({ message: 'Xóa câu hỏi thành công' });
  } catch (err) {
    if (err.message.includes('Không thể xóa')) {
      return res.status(409).json({ message: err.message });
    }
    console.error('remove question error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { getAll, getById, create, update, approve, reject, remove };

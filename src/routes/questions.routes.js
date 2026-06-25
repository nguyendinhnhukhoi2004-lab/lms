// routes/questions.routes.js

const express = require('express');
const { body } = require('express-validator');
const QuestionsController = require('../controllers/questions.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// Validation cơ bản cho trường bắt buộc — cấu trúc JSONB kiểm tra riêng trong controller
const createValidation = [
  body('subject_id')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('subject_id phải là UUID hợp lệ'),
  body('type')
    .isIn(['multiple_choice', 'true_false', 'essay'])
    .withMessage('Dạng câu hỏi phải là multiple_choice, true_false hoặc essay'),
  body('content')
    .trim()
    .notEmpty().withMessage('Nội dung câu hỏi không được để trống')
    .isLength({ min: 10 }).withMessage('Nội dung câu hỏi phải có ít nhất 10 ký tự'),
  body('difficulty')
    .isIn(['nhan_biet', 'thong_hieu', 'van_dung']) // CV 7991/BGDĐT: Biết / Hiểu / Vận dụng
    .withMessage('Mức độ không hợp lệ (dùng: nhan_biet / thong_hieu / van_dung)'),
  body('correct_answer')
    .notEmpty().withMessage('Đáp án đúng không được để trống')
    .isObject().withMessage('correct_answer phải là object JSON'),
];

const updateValidation = [
  body('content')
    .optional()
    .trim()
    .isLength({ min: 10 }).withMessage('Nội dung phải có ít nhất 10 ký tự'),
  body('difficulty')
    .optional()
    .isIn(['nhan_biet', 'thong_hieu', 'van_dung']) // CV 7991/BGDĐT: Biết / Hiểu / Vận dụng
    .withMessage('Mức độ không hợp lệ (dùng: nhan_biet / thong_hieu / van_dung)'),
  body('correct_answer')
    .optional()
    .isObject().withMessage('correct_answer phải là object JSON'),
];

// GET /api/questions — giáo viên trở lên
router.get(
  '/',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  QuestionsController.getAll
);

// GET /api/questions/:id
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  QuestionsController.getById
);

// POST /api/questions — giáo viên hoặc tổ trưởng tạo câu hỏi
router.post(
  '/',
  authenticate,
  authorize('teacher', 'department_head'),
  createValidation,
  QuestionsController.create
);

// PUT /api/questions/:id — sửa câu hỏi (chưa duyệt)
router.put(
  '/:id',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  updateValidation,
  QuestionsController.update
);

// PATCH /api/questions/:id/approve — tổ trưởng phê duyệt
router.patch(
  '/:id/approve',
  authenticate,
  authorize('department_head'),
  QuestionsController.approve
);

// PATCH /api/questions/:id/reject — tổ trưởng / admin từ chối
router.patch(
  '/:id/reject',
  authenticate,
  authorize('department_head', 'admin'),
  QuestionsController.reject
);

// DELETE /api/questions/:id
router.delete(
  '/:id',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  QuestionsController.remove
);

module.exports = router;

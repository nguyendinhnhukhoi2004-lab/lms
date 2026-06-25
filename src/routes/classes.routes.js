// routes/classes.routes.js

const express = require('express');
const { body } = require('express-validator');
const ClassesController = require('../controllers/classes.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

const classValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên lớp không được để trống')
    .isLength({ max: 20 }).withMessage('Tên lớp tối đa 20 ký tự'),
  body('grade')
    .isInt({ min: 10, max: 12 }).withMessage('Khối lớp phải là 10, 11 hoặc 12'),
  body('school_year')
    .matches(/^\d{4}-\d{4}$/).withMessage('Năm học phải đúng định dạng YYYY-YYYY (VD: 2025-2026)'),
];

// GET — giáo viên trở lên đều xem được
router.get('/',   authenticate, authorize('admin','department_head','teacher'), ClassesController.getAll);
router.get('/:id/students', authenticate, authorize('admin','department_head','teacher'), ClassesController.getStudents);
router.get('/:id', authenticate, authorize('admin','department_head','teacher'), ClassesController.getById);

// Thêm/sửa/xóa — chỉ admin
router.post('/',    authenticate, authorize('admin'), classValidation, ClassesController.create);
router.put('/:id',  authenticate, authorize('admin'), classValidation, ClassesController.update);
router.delete('/:id', authenticate, authorize('admin'), ClassesController.remove);

module.exports = router;

// routes/subjects.routes.js

const express = require('express');
const { body } = require('express-validator');
const SubjectsController = require('../controllers/subjects.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

const subjectValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Tên môn học không được để trống')
    .isLength({ max: 100 }).withMessage('Tên môn học tối đa 100 ký tự'),
  body('grade')
    .isInt({ min: 10, max: 12 }).withMessage('Khối lớp phải là 10, 11 hoặc 12'),
  body('description')
    .optional()
    .isLength({ max: 500 }).withMessage('Mô tả tối đa 500 ký tự'),
];

// GET — tất cả role đã đăng nhập đều xem được
router.get('/',    authenticate, SubjectsController.getAll);
router.get('/:id', authenticate, SubjectsController.getById);

// Thêm/sửa/xóa — chỉ admin
router.post('/',    authenticate, authorize('admin'), subjectValidation, SubjectsController.create);
router.put('/:id',  authenticate, authorize('admin'), subjectValidation, SubjectsController.update);
router.delete('/:id', authenticate, authorize('admin'), SubjectsController.remove);

module.exports = router;

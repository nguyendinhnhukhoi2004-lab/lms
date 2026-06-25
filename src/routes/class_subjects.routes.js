// src/routes/class_subjects.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/class_subjects.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

router.use(authenticate); // Add authenticate before authorize

// Lấy toàn bộ phân công
router.get('/', authorize('admin', 'department_head', 'teacher'), controller.getAll);

// Lấy danh sách lớp/môn mà giáo viên dạy
router.get('/teacher/:teacher_id', authorize('admin', 'department_head', 'teacher'), controller.getTeacherClasses);

// Lấy danh sách môn học của 1 lớp
router.get('/:class_id', authorize('admin', 'department_head'), controller.getByClass);

// Cập nhật phân công giáo viên cho các môn của lớp
router.post('/:class_id/assign', authorize('admin', 'department_head'), controller.assignToClass);

module.exports = router;

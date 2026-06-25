// routes/auth.routes.js
// Định nghĩa các endpoint liên quan đến xác thực
// Validation dùng express-validator — kiểm tra dữ liệu trước khi vào controller

const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// POST /api/auth/login
// Validate: email đúng định dạng, password không rỗng
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email không hợp lệ').normalizeEmail(),
    body('password').notEmpty().withMessage('Mật khẩu không được để trống'),
  ],
  AuthController.login
);

// POST /api/auth/refresh  — không cần authenticate (dùng cookie)
router.post('/refresh', AuthController.refresh);

// POST /api/auth/logout   — không cần authenticate (chỉ xóa cookie)
router.post('/logout', AuthController.logout);

// GET /api/auth/me        — cần đăng nhập
router.get('/me', authenticate, AuthController.me);

// PUT /api/auth/change-password
router.put(
  '/change-password',
  authenticate,
  [
    body('old_password').notEmpty().withMessage('Mật khẩu cũ không được để trống'),
    body('new_password').isLength({ min: 6 }).withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
  ],
  AuthController.changePassword
);

module.exports = router;

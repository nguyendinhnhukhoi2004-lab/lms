// controllers/auth.controller.js
// Xử lý logic đăng nhập, làm mới token, đăng xuất
// Controller chỉ điều phối — không chứa query SQL trực tiếp

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');
const jwtConfig = require('../config/jwt');

// Tạo access token (ngắn hạn — 15 phút)
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      class_id: user.class_id,
    },
    jwtConfig.access.secret,
    { expiresIn: jwtConfig.access.expires }
  );
};

// Tạo refresh token (dài hạn — 7 ngày)
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    jwtConfig.refresh.secret,
    { expiresIn: jwtConfig.refresh.expires }
  );
};

// POST /api/auth/login
// Body: { email, password }
const login = async (req, res) => {
  // Kiểm tra lỗi validation từ express-validator (khai báo trong route)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // 1. Tìm user theo email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Trả lỗi chung — không tiết lộ "email không tồn tại"
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // 2. So sánh password với hash trong DB
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // 3. Tạo cặp token
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 4. Gửi refresh token qua httpOnly cookie (JavaScript không đọc được)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,   // không đọc được bằng JS — chống XSS
      secure: process.env.NODE_ENV === 'production', // chỉ HTTPS ở production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (ms)
    });

    // 5. Trả access token + thông tin user (không trả password_hash)
    return res.status(200).json({
      accessToken,
      user: {
        id:        user.id,
        full_name: user.full_name,
        email:     user.email,
        role:      user.role,
        class_id:  user.class_id,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/auth/refresh
// Dùng refresh token trong cookie để cấp access token mới
const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({ message: 'Không có refresh token' });
  }

  try {
    const decoded = jwt.verify(token, jwtConfig.refresh.secret);
    const user = await UserModel.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const accessToken = generateAccessToken(user);
    return res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }
};

// POST /api/auth/logout
// Xóa refresh token cookie — client cũng tự xóa access token
const logout = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  return res.status(200).json({ message: 'Đăng xuất thành công' });
};

// GET /api/auth/me
// Trả thông tin user đang đăng nhập (đã qua middleware authenticate)
const me = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { old_password, new_password } = req.body;
  const userId = req.user.id;

  try {
    const userWithPwd = await UserModel.findByIdWithPassword(userId);
    if (!userWithPwd) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const isMatch = await bcrypt.compare(old_password, userWithPwd.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác' });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    await UserModel.update(userId, { password_hash: newPasswordHash });

    return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { login, refresh, logout, me, changePassword };

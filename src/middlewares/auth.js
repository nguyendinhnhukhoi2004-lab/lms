// middlewares/auth.js
// Middleware xác thực JWT — chạy TRƯỚC mọi route cần đăng nhập
// Nếu token hợp lệ: gắn thông tin user vào req.user rồi next()
// Nếu token không hợp lệ: trả về 401 ngay, không cho vào route

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

const authenticate = (req, res, next) => {
  // Lấy token từ header: "Authorization: Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // lấy phần sau "Bearer "

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy token xác thực' });
  }

  try {
    // Giải mã token — sẽ throw error nếu token sai hoặc hết hạn
    const decoded = jwt.verify(token, jwtConfig.access.secret);

    // Gắn payload vào req để các controller dùng tiếp
    // decoded chứa: { id, email, role, iat, exp }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token đã hết hạn, vui lòng đăng nhập lại' });
    }
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
};

module.exports = { authenticate };

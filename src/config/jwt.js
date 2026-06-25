// config/jwt.js
// Tập trung cấu hình JWT ở một chỗ — không rải rác trong code

require('dotenv').config();

module.exports = {
  access: {
    secret:  process.env.JWT_ACCESS_SECRET,
    expires: process.env.JWT_ACCESS_EXPIRES || '15m',
    // Access token ngắn hạn (15 phút) — nếu bị lộ thì thiệt hại ít
  },
  refresh: {
    secret:  process.env.JWT_REFRESH_SECRET,
    expires: process.env.JWT_REFRESH_EXPIRES || '7d',
    // Refresh token dài hạn (7 ngày) — dùng để cấp access token mới
    // Lưu trong httpOnly cookie, không đọc được bằng JavaScript
  },
};

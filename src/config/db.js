// config/db.js
// Pool kết nối PostgreSQL — dùng chung toàn project
// Thay vì mở/đóng kết nối mỗi request, Pool giữ sẵn nhiều kết nối
// để tái sử dụng, giúp hệ thống chịu tải tốt hơn

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max:      10,    // tối đa 10 kết nối cùng lúc
  idleTimeoutMillis: 30000, // đóng kết nối nhàn rỗi sau 30 giây
});

// Kiểm tra kết nối khi khởi động
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Lỗi kết nối PostgreSQL:', err.message);
    process.exit(1); // dừng server nếu không kết nối được DB
  }
  console.log('✅ Kết nối PostgreSQL thành công');
  release(); // trả kết nối về pool
});

// Hàm tiện ích để chạy query — dùng ở tất cả model files
// Ví dụ: const { rows } = await query('SELECT * FROM users WHERE id=$1', [id])
const query = (text, params) => pool.query(text, params);

// Hàm dùng khi cần transaction (nhiều query phải thành công cùng nhau)
// Ví dụ: tạo đề thi + thêm câu hỏi vào đề phải là 1 transaction
const getClient = () => pool.connect();

module.exports = { query, getClient };

// server.js
// Entry point — chỉ làm 1 việc: khởi động server lên cổng PORT
// Toàn bộ cấu hình nằm trong src/app.js

require('dotenv').config(); // load .env TRƯỚC mọi thứ khác
require('./src/config/db'); // kết nối DB ngay khi khởi động, kiểm tra lỗi sớm

const app  = require('./src/app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📋 Môi trường: ${process.env.NODE_ENV || 'development'}`);
});

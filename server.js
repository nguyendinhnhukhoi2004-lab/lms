// server.js
// Entry point — chỉ làm 1 việc: khởi động server lên cổng PORT
// Toàn bộ cấu hình nằm trong src/app.js

require('dotenv').config(); // load .env TRƯỚC mọi thứ khác
require('./src/config/db'); // kết nối DB ngay khi khởi động, kiểm tra lỗi sớm

const app  = require('./src/app');
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📋 Môi trường: ${process.env.NODE_ENV || 'development'}`);
});

// Chạy job tự động nộp bài mỗi phút
const { autoSubmitExpiredExams } = require('./src/jobs/autoSubmit');
const interval = parseInt(process.env.AUTO_SUBMIT_INTERVAL || 60000, 10);
const autoSubmitInterval = setInterval(autoSubmitExpiredExams, interval);

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\nĐang tắt server...');
  clearInterval(autoSubmitInterval);
  server.close(() => {
    console.log('Đã đóng các kết nối.');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

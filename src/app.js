// src/app.js
// Cấu hình Express: đăng ký middleware bảo mật, logging, routes
// Tách khỏi server.js để dễ test (import app mà không cần listen)

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes    = require('./routes/auth.routes');
const userRoutes           = require('./routes/users.routes');
const teacherSubjectRoutes = require('./routes/teacher_subjects.routes');
const classRoutes   = require('./routes/classes.routes');
const subjectRoutes   = require('./routes/subjects.routes');
const questionRoutes  = require('./routes/questions.routes');
const examRoutes        = require('./routes/exams.routes');
const submissionRoutes  = require('./routes/submissions.routes');
const statisticsRoutes  = require('./routes/statistics.routes');
const classSubjectsRoutes = require('./routes/class_subjects.routes');

const app = express();

// --- Bảo mật ---
app.use(helmet()); // tự động set các HTTP header bảo mật (XSS, clickjacking...)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // địa chỉ React app
  credentials: true, // cho phép gửi cookie qua CORS (cần cho refreshToken)
}));

// --- Parsing ---
app.use(express.json());          // parse body JSON
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());          // parse cookie (cần cho refresh token)

// --- Logging ---
app.use(morgan('dev')); // log mỗi request: method, path, status, thời gian

// --- Routes ---
app.use('/api/auth',     authRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/teacher-subjects', teacherSubjectRoutes);
app.use('/api/classes',  classRoutes);
app.use('/api/subjects',   subjectRoutes);
app.use('/api/questions',  questionRoutes);
app.use('/api/exams',        examRoutes);
app.use('/api/submissions',  submissionRoutes);
app.use('/api/statistics',   statisticsRoutes);
app.use('/api/grades',       require('./routes/grades.routes'));
app.use('/api/class-subjects', classSubjectsRoutes);

// --- Health check ---
app.get('/health', async (req, res) => {
  const { query } = require('./config/db');
  let dbOk = false;
  let nlpOk = false;

  try { await query('SELECT 1'); dbOk = true; } catch {}
  try {
    const r = await fetch(`${process.env.NLP_SERVICE_URL || 'http://localhost:5001'}/health`,
      { signal: AbortSignal.timeout(2000) });
    nlpOk = r.ok;
  } catch {}

  const allOk = dbOk && nlpOk;
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    services: { database: dbOk ? 'ok' : 'error', nlp: nlpOk ? 'ok' : 'error' },
  });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ message: `Không tìm thấy route: ${req.method} ${req.path}` });
});

// --- Global error handler ---
// Express nhận biết error handler khi có 4 tham số (err, req, res, next)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Lỗi server nội bộ' });
});

module.exports = app;

// routes/statistics.routes.js

const express = require('express');
const StatsController = require('../controllers/statistics.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize }    = require('../middlewares/authorize');

const router = express.Router();

// Nhóm quyền tái sử dụng
const TEACHER_UP  = ['admin', 'department_head', 'teacher'];
const MANAGER_UP  = ['admin', 'department_head'];

// ── HỌC SINH — xem tiến độ bản thân ──────────────────────────────
router.get('/my-progress', authenticate, authorize('student'), StatsController.getMyProgress);
router.get('/my-summary',  authenticate, authorize('student'), StatsController.getMySummary);

// ── KỲ THI — giáo viên phân tích kết quả 1 lịch thi ─────────────
router.get(
  '/schedule/:scheduleId',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getScheduleSummary
);
router.get(
  '/schedule/:scheduleId/distribution',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getScoreDistribution
);
router.get(
  '/schedule/:scheduleId/questions',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getQuestionAnalysis
);
// GET /api/statistics/schedule/:scheduleId/export — xuất bảng điểm Excel
router.get(
  '/schedule/:scheduleId/export',
  authenticate, authorize(...TEACHER_UP),
  StatsController.exportScheduleExcel
);

// Endpoint tổng hợp — 1 request lấy hết (dùng cho trang báo cáo)
router.get(
  '/schedule/:scheduleId/full',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getScheduleFull
);

// ── LỚP ─────────────────────────────────────────────────────────
router.get(
  '/class/:classId',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getClassHistory
);

// ── HỌC SINH CỤ THỂ — giáo viên / admin xem ─────────────────────
router.get(
  '/student/:studentId/progress',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getStudentProgress
);

// ── TOÀN TRƯỜNG — admin / tổ trưởng ──────────────────────────────
router.get(
  '/overview',
  authenticate, authorize(...MANAGER_UP),
  StatsController.getSchoolOverview
);
router.get(
  '/question-bank',
  authenticate, authorize(...TEACHER_UP),
  StatsController.getQuestionBankStats
);

module.exports = router;

// Alias: học sinh tự xem qua path /student/summary và /student/progress
// (frontend dùng path này cho nhất quán)
router.get('/student/summary',  authenticate, authorize('student'), StatsController.getMySummary);
router.get('/student/progress', authenticate, authorize('student'), StatsController.getMyProgress);

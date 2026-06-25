// routes/submissions.routes.js

const express = require('express');
const { body } = require('express-validator');
const SubmissionsController = require('../controllers/submissions.controller');
const { authenticate }  = require('../middlewares/auth');
const { authorize }     = require('../middlewares/authorize');

const router = express.Router();

// ── KẾT QUẢ ─────────────────────────────────────────────────────
// (đặt trước /:id để tránh conflict)

// GET /api/submissions/my-results — học sinh xem lịch sử điểm
router.get(
  '/my-results',
  authenticate,
  authorize('student'),
  SubmissionsController.getMyResults
);

// GET /api/submissions/schedule/:scheduleId/results — giáo viên xem cả lớp
router.get(
  '/schedule/:scheduleId/results',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  SubmissionsController.getClassResults
);

// ── PHÒNG THI ────────────────────────────────────────────────────

// POST /api/submissions/enter — vào phòng thi
// Học sinh vào thi, nhận đề đã xáo trộn
router.post(
  '/enter',
  authenticate,
  authorize('student'),
  [body('schedule_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('schedule_id phải là UUID hợp lệ')],
  SubmissionsController.enter
);

// POST /api/submissions/:id/answer — auto-save câu trả lời
// Gọi mỗi khi học sinh chọn đáp án (debounce ở frontend ~1 giây)
router.post(
  '/:id/answer',
  authenticate,
  authorize('student'),
  [
    body('question_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('question_id phải là UUID hợp lệ'),
    body('student_answer').notEmpty().withMessage('student_answer không được để trống'),
  ],
  SubmissionsController.saveAnswer
);

// POST /api/submissions/:id/submit — nộp bài
router.post(
  '/:id/submit',
  authenticate,
  authorize('student'),
  SubmissionsController.submitExam
);

// GET /api/submissions/:id/result — xem kết quả sau khi nộp
router.get(
  '/:id/result',
  authenticate,
  authorize('student', 'teacher', 'department_head', 'admin'),
  SubmissionsController.getResult
);

// PATCH /api/submissions/:id/grade — giáo viên chỉnh điểm tự luận
router.patch(
  '/:id/grade',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  [
    body('question_id').matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).withMessage('question_id phải là UUID hợp lệ'),
    body('final_score')
      .isFloat({ min: 0 }).withMessage('Điểm phải là số không âm'),
  ],
  SubmissionsController.gradeEssayManual
);

module.exports = router;

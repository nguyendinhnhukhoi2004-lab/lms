// routes/exams.routes.js

const express = require('express');
const multer  = require('multer');
const { body } = require('express-validator');
const ExamsController = require('../controllers/exams.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|docx|doc)$/i)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận .xlsx, .xls, .docx hoặc .doc'), false);
  },
});

const router = express.Router();

// Validation tạo đề thi
const createExamValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Tên đề thi không được để trống')
    .isLength({ max: 200 }).withMessage('Tên đề tối đa 200 ký tự'),
  body('subject_id')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('subject_id phải là UUID hợp lệ'),
  body('duration_minutes')
    .isInt({ min: 5, max: 300 }).withMessage('Thời gian làm bài phải từ 5 đến 300 phút'),
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('Mô tả tối đa 1000 ký tự'),
];

// Validation lên lịch thi
const createScheduleValidation = [
  body('exam_id')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('exam_id phải là UUID hợp lệ'),
  body('class_id')
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('class_id phải là UUID hợp lệ'),
  body('start_time')
    .isISO8601().withMessage('start_time phải đúng định dạng ISO 8601 (VD: 2026-05-10T07:30:00Z)'),
  body('end_time')
    .isISO8601().withMessage('end_time phải đúng định dạng ISO 8601'),
];

// ── LỊCH THI (đặt TRƯỚC /:id để tránh conflict route) ──────────

// GET /api/exams/schedules — xem lịch thi
router.get(
  '/schedules',
  authenticate,
  authorize('admin', 'department_head', 'teacher', 'student'),
  ExamsController.getSchedules
);

// POST /api/exams/schedules — tạo lịch thi
router.post(
  '/schedules',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  createScheduleValidation,
  ExamsController.createSchedule
);

// PATCH /api/exams/schedules/:id/cancel — hủy lịch thi
router.patch(
  '/schedules/:id/cancel',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.cancelSchedule
);

// PATCH /api/exams/schedules/:id — dời lịch thi (update times)
router.patch(
  '/schedules/:id',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  body('start_time').isISO8601().withMessage('start_time phải đúng định dạng ISO 8601'),
  body('end_time').isISO8601().withMessage('end_time phải đúng định dạng ISO 8601'),
  ExamsController.updateSchedule
);

// DELETE /api/exams/schedules/:id — xóa lịch thi
router.delete(
  '/schedules/:id',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.deleteSchedule
);

// ── ĐỀ THI ──────────────────────────────────────────────────────

// GET /api/exams
router.get(
  '/',
  authenticate,
  authorize('admin', 'department_head', 'teacher', 'student'),
  ExamsController.getAll
);

// GET /api/exams/:id
router.get(
  '/:id',
  authenticate,
  authorize('admin', 'department_head', 'teacher', 'student'),
  ExamsController.getById
);

// GET /api/exams/:id/export
router.get(
  '/:id/export',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.exportExcel
);

// POST /api/exams — tạo đề thi mới (bản nháp)
router.post(
  '/',
  authenticate,
  authorize('admin', 'teacher', 'department_head'),
  createExamValidation,
  ExamsController.create
);

// DELETE /api/exams/:id — xóa đề thi
router.delete(
  '/:id',
  authenticate,
  authorize('admin', 'teacher', 'department_head'),
  ExamsController.deleteExam
);

// POST /api/exams/parse-file — parse file trả về câu hỏi, KHÔNG lưu DB
router.post(
  '/parse-file',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  upload.single('file'),
  ExamsController.parseFileOnly
);

// POST /api/exams/import-file — parse file và tạo đề luôn
router.post(
  '/import-file',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  upload.single('file'),
  ExamsController.importFileCreateExam
);

// PUT /api/exams/:id/questions — thêm câu hỏi thủ công
router.put(
  '/:id/questions',
  authenticate,
  authorize('teacher', 'department_head'),
  ExamsController.setQuestions
);

// POST /api/exams/:id/auto-generate — tạo đề tự động
router.post(
  '/:id/auto-generate',
  authenticate,
  authorize('teacher', 'department_head'),
  ExamsController.autoGenerate
);

// PATCH /api/exams/:id/submit — giáo viên gửi đề duyệt
router.patch(
  '/:id/submit',
  authenticate,
  authorize('teacher', 'department_head'),
  ExamsController.submit
);

// PATCH /api/exams/:id/approve — tổ trưởng duyệt đề
router.patch(
  '/:id/approve',
  authenticate,
  authorize('department_head'),
  ExamsController.approve
);

// PATCH /api/exams/:id/reject — tổ trưởng từ chối, bắt buộc kèm lý do
router.patch(
  '/:id/reject',
  authenticate,
  authorize('department_head', 'admin'),
  body('reason')
    .trim()
    .notEmpty().withMessage('Lý do từ chối không được để trống')
    .isLength({ max: 500 }).withMessage('Lý do tối đa 500 ký tự'),
  ExamsController.reject
);

// ── MA TRẬN ĐỀ THI (Thông tư 22) ───────────────────────────────

// GET /api/exams/:id/matrix — xem ma trận + summary
router.get(
  '/:id/matrix',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.getMatrix
);

// PUT /api/exams/:id/matrix — lưu ma trận (chỉ khi draft)
router.put(
  '/:id/matrix',
  authenticate,
  authorize('teacher', 'department_head'),
  ExamsController.setMatrix
);

// POST /api/exams/:id/auto-generate-from-matrix — rút câu hỏi theo ma trận đã lưu
router.post(
  '/:id/auto-generate-from-matrix',
  authenticate,
  authorize('teacher', 'department_head'),
  ExamsController.autoGenerateFromMatrix
);

// ── NGHIỆP VỤ GDPT 2018 ──────────────────────────────────────

// POST /api/exams/:id/generate-rooms — trộn phòng thi
router.post(
  '/:id/generate-rooms',
  authenticate,
  authorize('admin', 'department_head'),
  ExamsController.generateRooms
);

// GET /api/exams/:id/rooms — xem danh sách phòng
router.get(
  '/:id/rooms',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.getRooms
);

// GET /api/exams/rooms/:roomId/students — xem học sinh trong phòng
router.get(
  '/rooms/:roomId/students',
  authenticate,
  authorize('admin', 'department_head', 'teacher'),
  ExamsController.getRoomStudents
);

// PATCH /api/exams/:id/trigger — kích hoạt thi thường xuyên
router.patch(
  '/:id/trigger',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  ExamsController.triggerExam
);

module.exports = router;

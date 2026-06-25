// src/routes/teacher_subjects.routes.js

const express    = require('express');
const router     = express.Router();
const Controller = require('../controllers/teacher_subjects.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize }    = require('../middlewares/authorize');

// GET /api/teacher-subjects/my-subjects — giáo viên / tổ trưởng xem môn của mình
router.get(
  '/my-subjects',
  authenticate,
  authorize('teacher', 'department_head'),
  Controller.getMySubjects
);

// GET /api/teacher-subjects/subject-names — danh sách tên môn (admin dùng)
router.get(
  '/subject-names',
  authenticate,
  authorize('admin'),
  Controller.getSubjectNames
);

// GET /api/teacher-subjects — toàn bộ phân công (admin)
router.get(
  '/',
  authenticate,
  authorize('admin'),
  Controller.getAll
);

// GET /api/teacher-subjects/teacher/:id — phân công của 1 giáo viên
router.get(
  '/teacher/:id',
  authenticate,
  authorize('admin'),
  Controller.getByTeacher
);

// PUT /api/teacher-subjects/teacher/:id — gán môn cho giáo viên
// Body: { subject_ids: [...] }
router.put(
  '/teacher/:id',
  authenticate,
  authorize('admin'),
  Controller.assignToTeacher
);

// GET /api/teacher-subjects/head/:id — môn phụ trách của tổ trưởng
router.get(
  '/head/:id',
  authenticate,
  authorize('admin'),
  Controller.getByHead
);

// PUT /api/teacher-subjects/head/:id — gán môn cho tổ trưởng
// Body: { subject_names: ["Toán", "Vật lý"] }
router.put(
  '/head/:id',
  authenticate,
  authorize('admin'),
  Controller.assignToHead
);

module.exports = router;

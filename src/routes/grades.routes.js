const express = require('express');
const GradesController = require('../controllers/grades.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// GET /api/grades/class-subject/:id
router.get(
  '/class-subject/:id',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  GradesController.getClassSubjectGrades
);

// GET /api/grades/homeroom/:id
router.get(
  '/homeroom/:id',
  authenticate,
  authorize('teacher', 'department_head', 'admin'),
  GradesController.getHomeroomGrades
);

module.exports = router;

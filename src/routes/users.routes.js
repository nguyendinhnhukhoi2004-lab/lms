// routes/users.routes.js

const express = require('express');
const multer  = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/i)) cb(null, true);
    else cb(new Error('Chỉ chấp nhận .xlsx'), false);
  },
});
const { body } = require('express-validator');
const UsersController = require('../controllers/users.controller');
const { authenticate } = require('../middlewares/auth');
const { authorize } = require('../middlewares/authorize');

const router = express.Router();

// Validation rules tái sử dụng
const createUserValidation = [
  body('full_name')
    .trim()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2–100 ký tự'),
  body('email')
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự'),
  body('role')
    .isIn(['admin', 'department_head', 'teacher', 'student'])
    .withMessage('Vai trò không hợp lệ'),
  body('class_id')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('class_id phải là UUID hợp lệ'),
];

// Chỉ yêu cầu đăng nhập ở mức router
router.use(authenticate);

// GET /api/users
router.get('/', authorize('admin', 'department_head', 'teacher'), UsersController.getAll);

// GET /api/users/:id
router.get('/:id', authorize('admin', 'department_head', 'teacher'), UsersController.getById);

// POST /api/users
router.post('/', authorize('admin'), createUserValidation, UsersController.create);

const updateUserValidation = [
  body('full_name')
    .optional()
    .trim()
    .notEmpty().withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 }).withMessage('Họ tên phải từ 2–100 ký tự'),
  body('email')
    .optional()
    .isEmail().withMessage('Email không hợp lệ')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 6 }).withMessage('Mật khẩu phải ít nhất 6 ký tự'),
  body('role')
    .optional()
    .isIn(['admin', 'department_head', 'teacher', 'student'])
    .withMessage('Vai trò không hợp lệ'),
  body('class_id')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage('class_id phải là UUID hợp lệ'),
];

// PUT /api/users/:id
router.put('/:id', authorize('admin'), updateUserValidation, UsersController.update);

// PATCH /api/users/:id/deactivate
router.patch('/:id/deactivate', authorize('admin'), UsersController.deactivate);

// PATCH /api/users/:id/activate
router.patch('/:id/activate', authorize('admin'), UsersController.activate);

// POST /api/users/parse-students — đọc file preview
router.post(
  '/parse-students',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  UsersController.parseStudents
);

// POST /api/users/import-students — import hàng loạt
router.post(
  '/import-students',
  authenticate,
  authorize('admin'),
  upload.single('file'),
  UsersController.importStudents
);

module.exports = router;

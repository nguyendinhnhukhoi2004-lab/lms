// controllers/users.controller.js
// Xử lý CRUD người dùng — chỉ admin được dùng toàn bộ
// Giáo viên chỉ xem được profile của chính mình (qua /auth/me)

const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const UserModel = require('../models/user.model');

// GET /api/users?role=student&page=1&limit=20
// Lấy danh sách người dùng — chỉ admin
const getAll = async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const result = await UserModel.findAll({
      role,
      page: parseInt(page),
      limit: parseInt(limit),
    });
    // FIX: trả về cả total, page, limit để frontend render phân trang
    return res.status(200).json(result);
  } catch (err) {
    console.error('getAll users error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// GET /api/users/:id
const getById = async (req, res) => {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error('getById user error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// POST /api/users
// Tạo tài khoản mới — admin tạo cho giáo viên/học sinh
const create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { full_name, email, password, role, class_id } = req.body;

  try {
    // Hash mật khẩu với bcrypt, độ phức tạp 12 vòng
    const password_hash = await bcrypt.hash(password, 12);

    const user = await UserModel.create({
      full_name,
      email,
      password_hash,
      role,
      class_id: class_id || null,
    });


    return res.status(201).json({
      message: 'Tạo tài khoản thành công',
      user,
    });
  } catch (err) {
    // Bắt lỗi unique email
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email đã được sử dụng' });
    }
    console.error('create user error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PUT /api/users/:id
// Cập nhật thông tin người dùng
const update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { full_name, email, password, role, class_id } = req.body;

  try {
    const payload = {
      full_name,
      email,
      role,
      class_id: class_id || null,
    };

    if (password) {
      payload.password_hash = await bcrypt.hash(password, 12);
    }

    const user = await UserModel.update(req.params.id, payload);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }


    return res.status(200).json({ message: 'Cập nhật thành công', user });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email đã được sử dụng' });
    }
    console.error('update user error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/users/:id/deactivate
// Vô hiệu hóa tài khoản (không xóa)
const deactivate = async (req, res) => {
  try {
    const user = await UserModel.deactivate(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    return res.status(200).json({ message: 'Đã vô hiệu hóa tài khoản', user });
  } catch (err) {
    console.error('deactivate user error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

// PATCH /api/users/:id/activate
// Kích hoạt lại tài khoản
const activate = async (req, res) => {
  try {
    const user = await UserModel.activate(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    return res.status(200).json({ message: 'Đã kích hoạt lại tài khoản', user });
  } catch (err) {
    console.error('activate user error:', err);
    return res.status(500).json({ message: 'Lỗi server' });
  }
};

module.exports = { getAll, getById, create, update, deactivate, activate };

// ── IMPORT HỌC SINH TỪ FILE EXCEL ────────────────────────────────
const XLSX = require('xlsx');

// POST /api/users/parse-students — đọc file trả về preview, KHÔNG lưu DB
const parseStudents = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng upload file .xlsx' });
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const students = rows
      .filter(r => r['full_name'] || r['Họ tên'] || r['ho_ten'])
      .map(r => ({
        full_name: (r['full_name'] || r['Họ tên'] || r['ho_ten'] || '').toString().trim(),
        email:     (r['email']    || r['Email']   || '').toString().trim().toLowerCase(),
        password:  (r['password'] || r['Mật khẩu'] || '').toString().trim(),
      }))
      .filter(s => s.full_name && s.email);

    return res.status(200).json({ students, total: students.length });
  } catch (err) {
    console.error('parseStudents error:', err);
    return res.status(500).json({ message: 'Lỗi đọc file Excel' });
  }
};

// POST /api/users/import-students — import hàng loạt học sinh vào 1 lớp
const importStudents = async (req, res) => {
  try {
    if (!req.file)        return res.status(400).json({ message: 'Vui lòng upload file' });
    if (!req.body.class_id) return res.status(400).json({ message: 'Vui lòng chọn lớp' });

    const { class_id } = req.body;
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const saved  = [];
    const errors = [];

    const { getClient } = require('../config/db');
    const client = await getClient();

    // KIỂM TRA LỚP CÓ TỒN TẠI KHÔNG
    const { rows: classCheck } = await client.query('SELECT id FROM classes WHERE id = $1', [class_id]);
    if (classCheck.length === 0) {
      client.release();
      return res.status(400).json({ message: 'Lớp học không tồn tại' });
    }

    try {
      await client.query('BEGIN');

      for (let i = 0; i < rows.length; i++) {
        const r         = rows[i];
        const full_name = (r['full_name'] || r['Họ tên'] || r['ho_ten'] || '').toString().trim();
        const email     = (r['email']    || r['Email']   || '').toString().trim().toLowerCase();
        const rawPwd    = (r['password'] || r['Mật khẩu'] || '').toString().trim();

        if (!full_name) continue; // bỏ qua dòng trống
        if (!email) { errors.push({ row: i + 2, error: `"${full_name}": thiếu email` }); continue; }
        if (!email.includes('@')) { errors.push({ row: i + 2, error: `"${email}": email không hợp lệ` }); continue; }

        // Mật khẩu mặc định = student@123 nếu không có trong file
        const password     = rawPwd || 'student@123';
        const password_hash = await bcrypt.hash(password, 10);

        try {
          const { rows: uRows } = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, class_id)
             VALUES ($1, $2, $3, 'student', $4)
             ON CONFLICT (email) DO UPDATE
               SET full_name = EXCLUDED.full_name,
                   class_id  = EXCLUDED.class_id
             RETURNING id, full_name, email`,
            [full_name, email, password_hash, class_id]
          );
          saved.push(uRows[0]);
        } catch (e) {
          errors.push({ row: i + 2, error: `"${email}": ${e.message}` });
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return res.status(201).json({
      message: `Import thành công ${saved.length} học sinh${errors.length > 0 ? `, bỏ qua ${errors.length} dòng lỗi` : ''}`,
      imported: saved.length,
      skipped:  errors.length,
      errors,
    });
  } catch (err) {
    console.error('importStudents error:', err);
    return res.status(500).json({ message: 'Lỗi server khi import' });
  }
};

module.exports = { getAll, getById, create, update, deactivate, activate, parseStudents, importStudents };

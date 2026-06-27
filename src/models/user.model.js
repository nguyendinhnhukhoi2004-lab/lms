// models/user.model.js
// Tất cả query liên quan đến bảng users
// Tách riêng khỏi controller để dễ test và tái sử dụng

const { query } = require('../config/db');

// Tìm user theo email — dùng khi đăng nhập
const findByEmail = async (email) => {
  const { rows } = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
    [email]
  );
  return rows[0] || null; // trả về user hoặc null nếu không tìm thấy
};

// Tìm user theo id — dùng để lấy thông tin profile
const findById = async (id) => {
  const { rows } = await query(
    `SELECT u.id, u.full_name, u.email, u.role, u.class_id, u.is_active, u.created_at,
            c.name AS class_name,
            (SELECT json_agg(subject_id) FROM class_subjects WHERE class_id = u.class_id) AS subject_ids
     FROM users u
     LEFT JOIN classes c ON u.class_id = c.id
     WHERE u.id = $1`,
    [id]
    // Không SELECT password_hash — không bao giờ trả hash về client
  );
  return rows[0] || null;
};

// Tìm user kèm password hash (chỉ dùng nội bộ để so sánh đổi mật khẩu)
const findByIdWithPassword = async (id) => {
  const { rows } = await query(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

// Tạo user mới — dùng khi admin tạo tài khoản
const create = async ({ full_name, email, password_hash, role, class_id }) => {
  const { rows } = await query(
    `INSERT INTO users (full_name, email, password_hash, role, class_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, full_name, email, role, class_id, is_active, created_at`,
    [full_name, email, password_hash, role, class_id || null]
  );
  return rows[0];
};

const update = async (id, { full_name, email, password_hash, role, class_id }) => {
  const fields = [];
  const values = [];

  if (full_name) {
    values.push(full_name);
    fields.push(`full_name = $${values.length}`);
  }
  if (email) {
    values.push(email);
    fields.push(`email = $${values.length}`);
  }
  if (password_hash) {
    values.push(password_hash);
    fields.push(`password_hash = $${values.length}`);
  }
  if (role) {
    values.push(role);
    fields.push(`role = $${values.length}`);
  }
  if (typeof class_id !== 'undefined') {
    values.push(class_id);
    fields.push(`class_id = $${values.length}`);
  }

  if (fields.length === 0) {
    return findById(id);
  }

  values.push(id);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length}
     RETURNING id, full_name, email, role, class_id, is_active, created_at`,
    values
  );
  return rows[0] || null;
};

// Lấy danh sách tất cả user — chỉ admin dùng, có phân trang
const findAll = async ({ page = 1, limit = 20, role }) => {
  const offset = (page - 1) * limit;

  let whereClause = '';
  let queryParams = [];
  
  if (role) {
    if (role === 'teacher') {
      whereClause = `WHERE u.role IN ('teacher', 'department_head')`;
    } else {
      whereClause = `WHERE u.role = $1`;
      queryParams.push(role);
    }
  }

  const countQuery = `SELECT COUNT(*)::int AS total FROM users u ${whereClause}`;
  const { rows: countRows } = await query(countQuery, queryParams);
  const total = countRows[0].total;

  let orderBy = 'u.role ASC, u.created_at DESC';
  if (role === 'teacher') {
    orderBy = "(SELECT regexp_replace(sub.name, ' [0-9]+$', '') FROM teacher_subjects ts JOIN subjects sub ON ts.subject_id = sub.id WHERE ts.teacher_id = u.id LIMIT 1) ASC, u.full_name ASC";
  } else if (role === 'student') {
    orderBy = 'c.name ASC, u.full_name ASC';
  }

  let queryStr = `
    SELECT u.id, u.full_name, u.email, u.role, u.class_id, u.is_active, u.created_at,
           c.name AS class_name,
           (SELECT json_agg(subject_id) FROM class_subjects WHERE class_id = u.class_id) AS subject_ids,
           (SELECT string_agg(DISTINCT sub.name, ', ') FROM teacher_subjects ts JOIN subjects sub ON ts.subject_id = sub.id WHERE ts.teacher_id = u.id) AS teacher_subjects_list
    FROM users u
    LEFT JOIN classes c ON u.class_id = c.id
    ${whereClause}
    ORDER BY ${orderBy}
  `;

  // Khi không có role filter, lấy TẤT CẢ users (không phân trang) 
  // để dashboard admin có thể thống kê đúng số lượng theo role và 
  // frontend UserManagement có thể làm client-side filtering
  if (role) {
    queryParams.push(limit, offset);
    queryStr += ` LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
  }

  const { rows } = await query(queryStr, queryParams);
  return { users: rows, total, page, limit };
};

// Vô hiệu hóa tài khoản (không xóa, chỉ set is_active = false)
const deactivate = async (id) => {
  const { rows } = await query(
    `UPDATE users SET is_active = FALSE WHERE id = $1
     RETURNING id, full_name, email, is_active`,
    [id]
  );
  return rows[0] || null;
};

// Kích hoạt lại tài khoản (set is_active = true)
const activate = async (id) => {
  const { rows } = await query(
    `UPDATE users SET is_active = TRUE WHERE id = $1
     RETURNING id, full_name, email, is_active`,
    [id]
  );
  return rows[0] || null;
};

module.exports = { findByEmail, findById, findByIdWithPassword, create, update, findAll, deactivate, activate };

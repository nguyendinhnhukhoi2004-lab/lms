require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'exam_system',
  password: process.env.DB_PASSWORD || 'khoi05112004',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  const client = await pool.connect();
  try {
    // 1. Lấy danh sách giáo viên/tổ trưởng hiện có với môn dạy và khối lớp
    const { rows: teachers } = await client.query(`
      SELECT 
        u.id, u.full_name, u.email, u.role,
        (
          SELECT string_agg(DISTINCT regexp_replace(s.name, ' [0-9]+$', ''), ', ' ORDER BY regexp_replace(s.name, ' [0-9]+$', ''))
          FROM teacher_subjects ts 
          JOIN subjects s ON ts.subject_id = s.id 
          WHERE ts.teacher_id = u.id
        ) as subject_name,
        (
          SELECT string_agg(DISTINCT c.grade::text, ',' ORDER BY c.grade::text)
          FROM class_subjects cs
          JOIN classes c ON cs.class_id = c.id
          WHERE cs.teacher_id = u.id
        ) as grades,
        (
          SELECT COUNT(DISTINCT cs.class_id)
          FROM class_subjects cs
          WHERE cs.teacher_id = u.id
        ) as class_count
      FROM users u
      WHERE u.role IN ('teacher', 'department_head')
      ORDER BY u.role DESC, subject_name ASC, grades ASC
    `);

    // 2. Chọn đại diện mỗi môn để cập nhật mật khẩu thành dễ nhớ
    const targetSubjects = [
      'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học',
      'Sinh học', 'Lịch sử', 'Địa lý', 'Tin học',
      'Giáo dục kinh tế và pháp luật',
      'Công nghệ Công nghiệp', 'Công nghệ Nông nghiệp'
    ];

    const newPassword = 'Test@123';
    const hash = await bcrypt.hash(newPassword, 10);

    const selected = [];
    const seenSubjects = new Set();

    // Ưu tiên tổ trưởng trước
    for (const t of teachers) {
      if (t.role === 'department_head' && t.subject_name && !seenSubjects.has(t.subject_name)) {
        seenSubjects.add(t.subject_name);
        selected.push(t);
      }
    }

    // Thêm 1 giáo viên đại diện cho mỗi môn (khối 10)
    for (const subName of targetSubjects) {
      const found = teachers.find(t =>
        t.role === 'teacher' &&
        t.subject_name === subName &&
        t.grades && t.grades.includes('10')
      );
      if (found) selected.push(found);
    }

    // Cập nhật mật khẩu thành Test@123 cho tất cả
    const allIds = [...new Set(selected.map(t => t.id))];
    await client.query(
      `UPDATE users SET password_hash = $1 WHERE id = ANY($2::uuid[])`,
      [hash, allIds]
    );

    // In bảng tóm tắt
    console.log('\n' + '='.repeat(100));
    console.log(' TÀI KHOẢN MẪU ĐỂ TEST HỆ THỐNG');
    console.log('='.repeat(100));
    console.log(' Mật khẩu chung cho tất cả tài khoản bên dưới: Test@123');
    console.log('='.repeat(100));

    // Nhóm tổ trưởng
    const heads = selected.filter(t => t.role === 'department_head');
    console.log('\n📋 TỔ TRƯỞNG (department_head) - có quyền DUYỆT đề thi:');
    console.log('-'.repeat(90));
    console.log(`${'Họ tên'.padEnd(22)} | ${'Email'.padEnd(30)} | ${'Môn phụ trách'.padEnd(35)} | Khối`);
    console.log('-'.repeat(90));
    for (const t of heads) {
      console.log(
        `${(t.full_name || '').padEnd(22)} | ${(t.email || '').padEnd(30)} | ${(t.subject_name || '').padEnd(35)} | ${t.grades || ''}`
      );
    }

    // Nhóm giáo viên
    const gvs = selected.filter(t => t.role === 'teacher');
    console.log('\n📋 GIÁO VIÊN (teacher) - có thể TẠO ĐỀ, CHẤM BÀI:');
    console.log('-'.repeat(100));
    console.log(`${'Họ tên'.padEnd(22)} | ${'Email'.padEnd(32)} | ${'Môn dạy'.padEnd(35)} | ${'Khối'.padEnd(6)} | Lớp`);
    console.log('-'.repeat(100));
    for (const t of gvs) {
      console.log(
        `${(t.full_name || '').padEnd(22)} | ${(t.email || '').padEnd(32)} | ${(t.subject_name || '').padEnd(35)} | ${(t.grades || '').padEnd(6)} | ${t.class_count}`
      );
    }

    console.log('\n' + '='.repeat(100));
    console.log(' HƯỚNG DẪN TEST NHANH:');
    console.log('='.repeat(100));
    console.log(' 1. Đăng nhập với tài khoản GIÁO VIÊN → Tạo câu hỏi → Tạo đề → Nộp đề lên tổ trưởng');
    console.log(' 2. Đăng nhập với TỔ TRƯỞNG cùng môn → Vào Quản lý đề thi → Duyệt đề');
    console.log(' 3. Đăng nhập với ADMIN (admin@thpt.edu.vn / admin123) → Tạo phòng thi → Xếp học sinh');
    console.log(' 4. Đăng nhập với tài khoản HỌC SINH → Làm bài thi → Nộp bài');
    console.log(' 5. Đăng nhập lại với GIÁO VIÊN → Vào Chấm tự luận → Xem điểm gợi ý NLP');
    console.log('='.repeat(100));
    console.log(` Tài khoản admin: admin@thpt.edu.vn  |  Mật khẩu: admin123`);
    console.log('='.repeat(100) + '\n');

  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();

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

const ho = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"];
const dem = ["Văn", "Hữu", "Đức", "Minh", "Thị", "Ngọc", "Thu", "Phương", "Thanh", "Hoài", "Quang", "Bảo", "Gia", "Khánh"];
const ten = ["Anh", "Bình", "Châu", "Dũng", "Dương", "Đạt", "Hải", "Hào", "Hiếu", "Hòa", "Huy", "Khang", "Khoa", "Kiên", "Lâm", "Long", "Nam", "Nghĩa", "Phong", "Phúc", "Quân", "Sơn", "Tài", "Thành", "Thắng", "Thiện", "Thịnh", "Tiến", "Toàn", "Trí", "Trọng", "Trung", "Tuấn", "Tùng", "Vinh", "Việt", "An", "Châu", "Chi", "Diệp", "Hà", "Hân", "Hoa", "Hương", "Huyền", "Linh", "Ly", "Mai", "Ngọc", "Nhi", "Nhung", "Oanh", "Phương", "Quyên", "Quỳnh", "Trang", "Trâm", "Tú", "Uyên", "Vân", "Vy", "Yến"];

function randomName() {
  const h = ho[Math.floor(Math.random() * ho.length)];
  const d = dem[Math.floor(Math.random() * dem.length)];
  const t = ten[Math.floor(Math.random() * ten.length)];
  return `${h} ${d} ${t}`;
}

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, '');
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Clean up old mock data safely
    console.log('Cleaning up old mock data...');
    await client.query(`DELETE FROM student_module_classes WHERE module_class_id IN (SELECT id FROM module_classes WHERE school_year = '2025-2026')`);
    await client.query(`DELETE FROM module_classes WHERE school_year = '2025-2026'`);
    await client.query(`DELETE FROM student_subjects WHERE student_id IN (SELECT id FROM users WHERE email LIKE 'hs%_%@thpt.edu.vn' OR email LIKE '%250%@thpt.edu.vn')`);
    await client.query(`DELETE FROM users WHERE role='student' AND (email LIKE 'hs%_%@thpt.edu.vn' OR email LIKE '%250%@thpt.edu.vn')`);
    await client.query(`DELETE FROM classes WHERE school_year = '2025-2026' AND id NOT IN (SELECT class_id FROM exam_schedules)`);

    // 1. Fetch subjects
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    
    const compulsorySubjects = subjects.filter(s => s.category === 'bat_buoc');
    const khtnSubjects = subjects.filter(s => s.category === 'khtn' || s.name.includes('Tin học'));
    const khxhSubjects = subjects.filter(s => s.category === 'khxh' || s.name.includes('Tin học'));

    // 2. Fetch teachers
    const { rows: teachers } = await client.query(`SELECT * FROM users WHERE role='teacher'`);
    const { rows: teacherSubjects } = await client.query('SELECT * FROM teacher_subjects');

    if (teachers.length === 0) {
      throw new Error('No teachers found in DB. Please run default seeds first.');
    }

    // 3. Create classes
    console.log('Creating classes for 2025-2026...');
    const createdClasses = [];
    for (const grade of [10, 11, 12]) {
      for (let i = 1; i <= 10; i++) {
        const className = `${grade}A${i}`;
        const res = await client.query(
          `INSERT INTO classes (name, grade, school_year) VALUES ($1, $2, $3) RETURNING id, name, grade`,
          [className, grade, '2025-2026']
        );
        createdClasses.push(res.rows[0]);
      }
    }

    // 4. Create students and student_subjects
    console.log('Creating students...');
    const hash = await bcrypt.hash('123456', 10);
    const createdStudents = [];
    
    let studentCounter = 1;
    for (const cls of createdClasses) {
      for (let i = 1; i <= 40; i++) {
        const fullName = randomName();
        const noAccentName = removeAccents(fullName);
        const studentCode = `250${studentCounter.toString().padStart(3, '0')}`; // e.g. 250001, 250002...
        const email = `${noAccentName}${studentCode}@thpt.edu.vn`;
        
        const res = await client.query(
          `INSERT INTO users (full_name, email, password_hash, role, class_id) 
           VALUES ($1, $2, $3, 'student', $4) RETURNING id`,
          [fullName, email, hash, cls.id]
        );
        const studentId = res.rows[0].id;
        createdStudents.push({ id: studentId, grade: cls.grade });
        studentCounter++;

        // Assign subjects
        const combo = Math.random() > 0.5 ? khtnSubjects : khxhSubjects;
        const mySubjects = [...compulsorySubjects, ...combo].filter(s => s.grade === cls.grade);
        
        for (const sub of mySubjects) {
          await client.query(
            `INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [studentId, sub.id]
          );
        }
      }
    }

    // 5. Create module classes and assign teachers
    console.log('Creating module classes...');
    const createdModuleClasses = []; // { id, subject_id, grade }
    for (const sub of subjects) {
      // Find eligible teachers for this subject
      const eligibleTeacherIds = teacherSubjects.filter(ts => ts.subject_id === sub.id).map(ts => ts.teacher_id);
      
      // Create 3 module classes per subject
      for (let i = 1; i <= 3; i++) {
        const tId = eligibleTeacherIds.length > 0 
          ? eligibleTeacherIds[Math.floor(Math.random() * eligibleTeacherIds.length)]
          : teachers[Math.floor(Math.random() * teachers.length)].id;
          
        const mcName = `${sub.name} - Lớp HP ${i}`;
        const res = await client.query(
          `INSERT INTO module_classes (subject_id, teacher_id, name, school_year) 
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [sub.id, tId, mcName, '2025-2026']
        );
        createdModuleClasses.push({ id: res.rows[0].id, subject_id: sub.id, grade: sub.grade });
      }
    }

    // 6. Enroll students in module classes
    console.log('Enrolling students...');
    for (const sub of subjects) {
      const myModuleClasses = createdModuleClasses.filter(mc => mc.subject_id === sub.id);
      
      // Get all students who registered for this subject
      const { rows: registeredStudents } = await client.query(
        `SELECT student_id FROM student_subjects WHERE subject_id = $1`,
        [sub.id]
      );
      
      let mcIndex = 0;
      for (const st of registeredStudents) {
        const mc = myModuleClasses[mcIndex];
        await client.query(
          `INSERT INTO student_module_classes (student_id, module_class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [st.student_id, mc.id]
        );
        mcIndex = (mcIndex + 1) % myModuleClasses.length;
      }
    }

    await client.query('COMMIT');
    console.log('Successfully seeded large database with real names and unique codes!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();

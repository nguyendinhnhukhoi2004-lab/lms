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

const MANDATORY_NAMES = ["Toán", "Ngữ văn", "Tiếng Anh", "Lịch sử", "GD Thể chất", "GD QPAN", "Hoạt động TN-HN", "Giáo dục địa phương"];
const ALL_POSSIBLE_SUBJECTS = [...MANDATORY_NAMES, "Vật lý", "Hóa học", "Sinh học", "Tin học", "Địa lý", "Mỹ thuật", "Công nghệ", "Giáo dục kinh tế và pháp luật", "Âm nhạc"];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Cleaning up old mock data...');
    // Clean up student subjects and module classes
    await client.query(`DELETE FROM student_module_classes WHERE module_class_id IN (SELECT id FROM module_classes WHERE school_year = '2025-2026')`);
    await client.query(`DELETE FROM module_classes WHERE school_year = '2025-2026'`);
    await client.query(`DELETE FROM student_subjects WHERE student_id IN (SELECT id FROM users WHERE role='student' AND email LIKE '%250%@thpt.edu.vn')`);
    await client.query(`DELETE FROM users WHERE role='student' AND email LIKE '%250%@thpt.edu.vn'`);
    await client.query(`DELETE FROM classes WHERE school_year = '2025-2026' AND id NOT IN (SELECT class_id FROM exam_schedules)`);

    console.log('Ensuring all subjects exist...');
    for (const grade of [10, 11, 12]) {
      for (const name of ALL_POSSIBLE_SUBJECTS) {
        let category = 'bat_buoc';
        if (["Vật lý", "Hóa học", "Sinh học"].includes(name)) category = 'khtn';
        if (["Địa lý", "Giáo dục kinh tế và pháp luật"].includes(name)) category = 'khxh';
        if (["Tin học", "Công nghệ", "Mỹ thuật", "Âm nhạc"].includes(name)) category = 'cong_nghe_nt';

        const fullName = `${name} ${grade}`;
        const { rows: existing } = await client.query(`SELECT id FROM subjects WHERE name = $1`, [fullName]);
        if (existing.length === 0) {
          await client.query(
            `INSERT INTO subjects (id, name, category, grade) VALUES (gen_random_uuid(), $1, $2, $3)`,
            [fullName, category, grade]
          );
        }
      }
    }

    // Refresh subjects map
    const { rows: allSubjectsDB } = await client.query('SELECT * FROM subjects');
    const getSubjectId = (name, grade) => {
      const s = allSubjectsDB.find(x => x.name === `${name} ${grade}` || x.name === name);
      if (!s) throw new Error(`Subject not found: ${name} ${grade}`);
      return s.id;
    };

    console.log('Creating classes and students...');
    const classConfigs = [
      { name: "T1", electives: ["Vật lý", "Hóa học", "Sinh học", "Tin học"] },
      { name: "T2", electives: ["Vật lý", "Hóa học", "Sinh học", "Tin học"] },
      { name: "T3", electives: ["Vật lý", "Hóa học", "Sinh học", "Tin học"] },
      { name: "T4", electives: ["Vật lý", "Hóa học", "Sinh học", "Tin học"] },
      { name: "T5", electives: ["Vật lý", "Hóa học", "Sinh học", "Tin học"] },
      { name: "T6", electives: ["Vật lý", "Hóa học", "Sinh học", "Địa lý"] },
      { name: "T7", electives: ["Vật lý", "Tin học", "Địa lý", "Mỹ thuật"] },
      { name: "X1", electives: ["Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ"] },
      { name: "X2", electives: ["Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ"] },
      { name: "X3", electives: ["Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ"] },
      { name: "X4", electives: ["Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Công nghệ"] },
      { name: "X5", electives: ["Địa lý", "Giáo dục kinh tế và pháp luật", "Tin học", "Âm nhạc"] },
    ];

    const hash = await bcrypt.hash('123456', 10);
    let studentCounter = 1;

    for (const grade of [10, 11, 12]) {
      for (const config of classConfigs) {
        const className = `${grade}${config.name}`;
        const res = await client.query(
          `INSERT INTO classes (name, grade, school_year) VALUES ($1, $2, $3) RETURNING id`,
          [className, grade, '2025-2026']
        );
        const classId = res.rows[0].id;

        // Create 35 students per class
        for (let i = 1; i <= 35; i++) {
          const fullName = randomName();
          const noAccentName = removeAccents(fullName);
          const studentCode = `250${studentCounter.toString().padStart(3, '0')}`;
          const email = `${noAccentName}${studentCode}@thpt.edu.vn`;
          
          const uRes = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role, class_id) VALUES ($1, $2, $3, 'student', $4) RETURNING id`,
            [fullName, email, hash, classId]
          );
          const studentId = uRes.rows[0].id;
          studentCounter++;

          // Assign mandatory + elective subjects
          const allMySubjects = [...MANDATORY_NAMES, ...config.electives];
          for (const subName of allMySubjects) {
            const subjectId = getSubjectId(subName, grade);
            await client.query(
              `INSERT INTO student_subjects (student_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [studentId, subjectId]
            );
          }
        }
      }
    }

    console.log('Seeding module classes...');
    // We will assign a random teacher from DB to the module classes.
    const { rows: teachers } = await client.query(`SELECT * FROM users WHERE role='teacher'`);
    if (teachers.length === 0) throw new Error('No teachers');

    // Just create 1 module class per subject per grade for simplicity (or let's skip module classes if the user mainly cared about classes and subject distribution? No, "Tạo thêm nhiều lớp học phần rồi phân công giáo viên").
    // Let's create 2 module classes for every unique subject used in 2025-2026.
    const usedSubjects = new Set();
    for (const grade of [10, 11, 12]) {
      for (const config of classConfigs) {
        for (const sub of [...MANDATORY_NAMES, ...config.electives]) {
          usedSubjects.add(`${sub} ${grade}`);
        }
      }
    }

    for (const subFullName of Array.from(usedSubjects)) {
      const s = allSubjectsDB.find(x => x.name === subFullName);
      if (!s) continue;
      
      const resReg = await client.query(`SELECT student_id FROM student_subjects WHERE subject_id = $1`, [s.id]);
      const registeredIds = resReg.rows.map(r => r.student_id);

      if (registeredIds.length === 0) continue;

      // Create 2 module classes
      for (let i = 1; i <= 2; i++) {
        const mcName = `${s.name} - Lớp HP ${i}`;
        const teacher = teachers[Math.floor(Math.random() * teachers.length)];
        const mcRes = await client.query(
          `INSERT INTO module_classes (subject_id, teacher_id, name, school_year) VALUES ($1, $2, $3, $4) RETURNING id`,
          [s.id, teacher.id, mcName, '2025-2026']
        );
        const mcId = mcRes.rows[0].id;

        // Enroll roughly half the students in each
        const half = Math.floor(registeredIds.length / 2);
        const mySt = i === 1 ? registeredIds.slice(0, half) : registeredIds.slice(half);

        for (const stId of mySt) {
          await client.query(
            `INSERT INTO student_module_classes (student_id, module_class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [stId, mcId]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Successfully applied curriculum classes!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
  } finally {
    client.release();
    pool.end();
  }
}

run();

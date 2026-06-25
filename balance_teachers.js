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
    
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    const { rows: moduleClasses } = await client.query('SELECT * FROM module_classes');
    let { rows: teacherSubjects } = await client.query('SELECT * FROM teacher_subjects');
    const { rows: teachers } = await client.query(`SELECT id FROM users WHERE role='teacher'`);
    
    const hash = await bcrypt.hash('123456', 10);
    let newTeacherCount = 0;
    
    // Create a map to track how many classes a teacher currently has
    const teacherLoad = {};
    for (const t of teachers) teacherLoad[t.id] = 0;

    // Group subjects by their base name (e.g. "Toán" instead of "Toán 10", "Toán 11")
    const subjectBases = {};
    for (const sub of subjects) {
      const baseName = sub.name.replace(/ \d+$/, '');
      if (!subjectBases[baseName]) subjectBases[baseName] = [];
      subjectBases[baseName].push(sub);
    }

    // For each subject base, figure out total module classes across all grades
    for (const [baseName, subs] of Object.entries(subjectBases)) {
      let totalMcsForBase = 0;
      const mcsForBase = [];
      for (const sub of subs) {
        const mcs = moduleClasses.filter(mc => mc.subject_id === sub.id);
        totalMcsForBase += mcs.length;
        mcsForBase.push(...mcs);
      }
      
      if (totalMcsForBase === 0) continue;

      // Calculate how many teachers we strictly need (max 6 classes per teacher)
      const reqTeachers = Math.ceil(totalMcsForBase / 6);
      
      // Get all teachers who teach any grade of this subject base
      const eligibleTeacherIds = new Set();
      for (const sub of subs) {
        const ts = teacherSubjects.filter(t => t.subject_id === sub.id);
        for (const t of ts) eligibleTeacherIds.add(t.teacher_id);
      }
      let eligibleTeachersArray = Array.from(eligibleTeacherIds);

      // If we don't have enough teachers for this subject, create them
      if (eligibleTeachersArray.length < reqTeachers) {
        const diff = reqTeachers - eligibleTeachersArray.length;
        for (let i = 0; i < diff; i++) {
          const fullName = randomName();
          const email = `${removeAccents(fullName)}${Date.now() + i}@thpt.edu.vn`;
          
          const res = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'teacher') RETURNING id`,
            [fullName, email, hash]
          );
          const tId = res.rows[0].id;
          newTeacherCount++;
          
          teacherLoad[tId] = 0; // init load

          // Assign this new teacher to all grades of this subject base so they are fully eligible
          for (const sub of subs) {
            await client.query(
              `INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2)`,
              [tId, sub.id]
            );
          }
          eligibleTeachersArray.push(tId);
        }
      }

      // Now distribute module classes to eligible teachers, ensuring nobody exceeds 6 classes
      // We sort eligible teachers by their current load ascending, to distribute fairly
      for (const mc of mcsForBase) {
        // Sort eligible teachers so the one with least load gets the class
        eligibleTeachersArray.sort((a, b) => (teacherLoad[a] || 0) - (teacherLoad[b] || 0));
        
        const chosenTeacherId = eligibleTeachersArray[0];
        await client.query(
          `UPDATE module_classes SET teacher_id = $1 WHERE id = $2`,
          [chosenTeacherId, mc.id]
        );
        teacherLoad[chosenTeacherId] = (teacherLoad[chosenTeacherId] || 0) + 1;
      }
    }
    
    await client.query('COMMIT');
    console.log(`Đã tạo thêm ${newTeacherCount} giáo viên mới để cân đối lớp học phần.`);
    console.log('Đã phân bổ lại toàn bộ lớp học phần (tối đa 6 lớp/giáo viên).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi cân bằng giáo viên:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();

require('dotenv').config();
const { Pool } = require('pg');

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
    await client.query('BEGIN');

    // Lấy dữ liệu
    const { rows: classes } = await client.query('SELECT * FROM classes ORDER BY grade, name');
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    const { rows: teachers } = await client.query("SELECT id, full_name FROM users WHERE role = 'teacher'");

    console.log(`Lấy được ${classes.length} lớp, ${subjects.length} môn học, ${teachers.length} giáo viên.`);

    // 1. Phân bổ giáo viên vào các bộ môn (Base Subjects)
    const baseSubjectsSet = new Set();
    subjects.forEach(s => baseSubjectsSet.add(s.name.replace(/ \d+$/, '')));
    const baseSubjects = Array.from(baseSubjectsSet);

    // Xóa phân công cũ
    await client.query('DELETE FROM class_subjects');
    await client.query('DELETE FROM teacher_subjects');

    // Phân bổ giáo viên cho các bộ môn đều nhau
    const teacherBaseSubjectMap = {}; // teacher_id -> base subject name
    const teachersByBaseSubject = {}; // base subject name -> array of teacher_ids
    
    baseSubjects.forEach(bs => teachersByBaseSubject[bs] = []);

    for (let i = 0; i < teachers.length; i++) {
      const bs = baseSubjects[i % baseSubjects.length];
      teacherBaseSubjectMap[teachers[i].id] = bs;
      teachersByBaseSubject[bs].push(teachers[i].id);
    }

    // Khởi tạo teacherLoad và teacherGrades
    const teacherLoad = {};
    const teacherGrades = {};
    for (const t of teachers) {
      teacherLoad[t.id] = 0;
      teacherGrades[t.id] = new Set();
    }

    // 2. Xác định tổ hợp môn cho từng lớp
    const classCombinations = {}; // class_id -> array of subject_ids
    
    for (const cls of classes) {
      const grade = cls.grade;
      const gradeSubjects = subjects.filter(s => s.grade === grade);
      
      const compulsoryNames = ['Toán', 'Ngữ văn', 'Tiếng Anh'];
      const compulsory = gradeSubjects.filter(s => compulsoryNames.some(cn => s.name.startsWith(cn)));
      
      let combo = [];
      const className = cls.name; // VD: 10T1, 10X1
      
      const isTClass = className.includes('T');
      const isXClass = className.includes('X');
      const num = parseInt(className.replace(/\D/g, '').replace(grade.toString(), '')) || 1; // Extract 1 from 10T1

      if (isTClass) {
        // T1 -> T7: KHTN
        combo = gradeSubjects.filter(s => 
          s.name.startsWith('Vật lý') || 
          s.name.startsWith('Hóa học') || 
          s.name.startsWith('Sinh học') || 
          s.name.startsWith('Tin học') ||
          s.name.startsWith('Công nghệ Công nghiệp')
        );
      } else if (isXClass) {
        // X1 -> X5: KHXH
        combo = gradeSubjects.filter(s => 
          s.name.startsWith('Lịch sử') || 
          s.name.startsWith('Địa lý') || 
          s.name.startsWith('Giáo dục kinh tế và pháp luật') || 
          s.name.startsWith('Tin học')
        );
        
        if (num <= 2) {
          combo.push(...gradeSubjects.filter(s => s.name.startsWith('Công nghệ Công nghiệp')));
        } else {
          combo.push(...gradeSubjects.filter(s => s.name.startsWith('Công nghệ Nông nghiệp')));
        }
      }

      classCombinations[cls.id] = [...compulsory.map(s => s.id), ...combo.map(s => s.id)];
    }

    // 3. Phân công lớp học phần (class_subjects) đều cho giáo viên
    let assignedCount = 0;

    for (const baseName of baseSubjects) {
      const eligibleTeachers = teachersByBaseSubject[baseName] || [];
      if (eligibleTeachers.length === 0) continue;

      // Pre-assign 2 grades per teacher if not done yet
      if (teacherGrades[eligibleTeachers[0]].size === 0) {
        const gradesForBase = [10, 11, 12];
        let gIndex = 0;
        for (const tId of eligibleTeachers) {
          teacherGrades[tId].add(gradesForBase[gIndex % 3]);
          teacherGrades[tId].add(gradesForBase[(gIndex + 1) % 3]);
          gIndex++;
        }
      }

      // Collect all needed classes for all subjects of this baseName
      let allNeededClasses = [];
      const baseSubList = subjects.filter(s => s.name.startsWith(baseName));
      for (const sub of baseSubList) {
        const neededClasses = classes.filter(c => classCombinations[c.id].includes(sub.id));
        allNeededClasses.push(...neededClasses.map(cls => ({ cls, sub })));
      }

      // Tính số giáo viên đủ điều kiện cho mỗi khối để ưu tiên phân công khối thiếu giáo viên trước
      const eligibleCountByGrade = { 10: 0, 11: 0, 12: 0 };
      for (const tId of eligibleTeachers) {
        for (const g of teacherGrades[tId]) {
          eligibleCountByGrade[g]++;
        }
      }

      // Sắp xếp ưu tiên các khối có ít giáo viên trước (để đảm bảo không bị dồn)
      allNeededClasses.sort((a, b) => eligibleCountByGrade[a.cls.grade] - eligibleCountByGrade[b.cls.grade]);

      // Phân công
      for (const item of allNeededClasses) {
        const cls = item.cls;
        const sub = item.sub;
        let eligibleForGrade = eligibleTeachers.filter(tId => teacherGrades[tId].has(cls.grade));
        
        if (eligibleForGrade.length === 0) eligibleForGrade = eligibleTeachers;

        eligibleForGrade.sort((a, b) => teacherLoad[a] - teacherLoad[b]);
        const chosenTeacherId = eligibleForGrade[0];

        await client.query(
          'INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES ($1, $2, $3)',
          [cls.id, sub.id, chosenTeacherId]
        );
        teacherLoad[chosenTeacherId]++;
        assignedCount++;
      }
    }

    console.log(`Đã phân công ${assignedCount} lớp học phần.`);

    // Insert vào teacher_subjects dựa trên các khối thực tế đã dạy
    for (const t of teachers) {
      const bs = teacherBaseSubjectMap[t.id];
      const grades = Array.from(teacherGrades[t.id]);
      
      // Nếu giáo viên không dạy lớp nào, gán đại khối 10
      if (grades.length === 0) grades.push(10);

      const matchingSubjects = subjects.filter(s => s.name.startsWith(bs) && grades.includes(s.grade));
      for (const ms of matchingSubjects) {
        await client.query('INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2)', [t.id, ms.id]);
      }
    }
    console.log('Đã cập nhật teacher_subjects theo khối lớp thực tế.');

    // Thống kê tải
    console.log('\n--- Thống kê phân công giáo viên ---');
    for (const t of teachers) {
      const grades = Array.from(teacherGrades[t.id]).join(', ');
      console.log(`${t.full_name} (${teacherBaseSubjectMap[t.id]}): ${teacherLoad[t.id]} lớp (Khối: ${grades})`);
    }

    await client.query('COMMIT');
    console.log('\nHOÀN TẤT!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi phân công:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();

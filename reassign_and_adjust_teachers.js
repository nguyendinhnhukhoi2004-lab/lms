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

    const { rows: classes } = await client.query('SELECT * FROM classes ORDER BY grade, name');
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    
    // Base subjects
    const baseSubjectsSet = new Set();
    subjects.forEach(s => baseSubjectsSet.add(s.name.replace(/ \d+$/, '')));
    const baseSubjects = Array.from(baseSubjectsSet);

    // Xác định tổ hợp môn cho từng lớp
    const classCombinations = {}; // class_id -> array of subject_ids
    const classesPerBaseSubject = {}; // baseName -> number of classes
    baseSubjects.forEach(bs => classesPerBaseSubject[bs] = 0);

    for (const cls of classes) {
      const grade = cls.grade;
      const gradeSubjects = subjects.filter(s => s.grade === grade);
      // Môn bắt buộc: Toán, Ngữ văn, Tiếng Anh, Lịch sử
      const compulsoryNames = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Lịch sử'];
      const compulsory = gradeSubjects.filter(s => compulsoryNames.some(cn => s.name.startsWith(cn)));
      
      let combo = [];
      const className = cls.name;
      const isTClass = className.includes('T');
      const isXClass = className.includes('X');

      // Lấy số của lớp (ví dụ: 10T6 -> 6, 10X3 -> 3)
      const match = className.match(/[TX](\d+)$/);
      const num = match ? parseInt(match[1]) : 1;

      if (isTClass) {
        if (num <= 5) {
          // T1-T5: Vật lý, Hóa học, Sinh học, Tin học
          combo = gradeSubjects.filter(s =>
            s.name.startsWith('Vật lý') ||
            s.name.startsWith('Hóa học') ||
            s.name.startsWith('Sinh học') ||
            s.name.startsWith('Tin học')
          );
        } else if (num === 6) {
          // T6: Vật lý, Hóa học, Sinh học, Địa lý
          combo = gradeSubjects.filter(s =>
            s.name.startsWith('Vật lý') ||
            s.name.startsWith('Hóa học') ||
            s.name.startsWith('Sinh học') ||
            s.name.startsWith('Địa lý')
          );
        } else if (num === 7) {
          // T7: Vật lý, Tin học, Địa lý
          combo = gradeSubjects.filter(s =>
            s.name.startsWith('Vật lý') ||
            s.name.startsWith('Tin học') ||
            s.name.startsWith('Địa lý')
          );
        }
      } else if (isXClass) {
        // X1-X5 đều có: Địa lý, GDKTPL, Tin học
        combo = gradeSubjects.filter(s =>
          s.name.startsWith('Địa lý') ||
          s.name.startsWith('Giáo dục kinh tế và pháp luật') ||
          s.name.startsWith('Tin học')
        );
        if (num === 1 || num === 2) {
          // X1, X2: thêm Công nghệ Công nghiệp
          combo.push(...gradeSubjects.filter(s => s.name.startsWith('Công nghệ Công nghiệp')));
        } else if (num === 3 || num === 4) {
          // X3, X4: thêm Công nghệ Nông nghiệp
          combo.push(...gradeSubjects.filter(s => s.name.startsWith('Công nghệ Nông nghiệp')));
        }
        // X5: chỉ Địa lý, GDKTPL, Tin học - không thêm gì
      }

      const assignedSubjectIds = [...compulsory.map(s => s.id), ...combo.map(s => s.id)];
      classCombinations[cls.id] = assignedSubjectIds;

      assignedSubjectIds.forEach(subId => {
        const sub = subjects.find(s => s.id === subId);
        const baseName = sub.name.replace(/ \d+$/, '');
        classesPerBaseSubject[baseName]++;
      });
    }

    // Tính toán số lượng giáo viên cần thiết cho mỗi khối của mỗi môn
    const targetTeachersPerBaseGrade = {};
    const targetTeachersPerBase = {};
    
    for (const bs of baseSubjects) {
      targetTeachersPerBaseGrade[bs] = { 10: 0, 11: 0, 12: 0 };
      
      // Mục tiêu tải theo môn:
      // - Toán, Văn, Anh: ~8 lớp/gv
      // - Tin học, Lịch sử: ~6 lớp/gv (giảm GV xuống)
      // - Các môn khác: ~4 lớp/gv
      let targetLoad;
      if (['Toán', 'Ngữ văn', 'Tiếng Anh'].includes(bs)) {
        targetLoad = 8;
      } else if (['Tin học', 'Lịch sử'].includes(bs)) {
        targetLoad = 6;
      } else {
        targetLoad = 4;
      }
      
      [10, 11, 12].forEach(grade => {
        let classesForGrade = 0;
        for (const cls of classes) {
          if (cls.grade === grade && classCombinations[cls.id].some(id => subjects.find(s => s.id === id).name.startsWith(bs))) {
            classesForGrade++;
          }
        }
        if (classesForGrade > 0) {
          let needed = Math.round(classesForGrade / targetLoad);
          if (needed < 1) needed = 1;
          targetTeachersPerBaseGrade[bs][grade] = needed;
        }
      });
      
      targetTeachersPerBase[bs] = targetTeachersPerBaseGrade[bs][10] + targetTeachersPerBaseGrade[bs][11] + targetTeachersPerBaseGrade[bs][12];
    }

    // Xóa phân công cũ
    await client.query('DELETE FROM class_subjects');
    await client.query('DELETE FROM teacher_subjects');

    // Lấy tổ trưởng và ánh xạ sang môn dạy
    // Tổ trưởng cũng là giáo viên, sẽ được đưa vào pool phân công
    const { rows: deptHeads } = await client.query(
      `SELECT u.id, u.full_name, hs.subject_name FROM users u JOIN head_subjects hs ON u.id = hs.head_id WHERE u.role = 'department_head'`
    );

    // Map tổ trưởng theo tên môn cơ sở (bỏ số khối lớp)
    const headByBaseSubject = {};
    for (const head of deptHeads) {
      const baseName = head.subject_name.replace(/ \d+$/, '');
      // Một số tổ trưởng quản lý tổ có tên khác (ví dụ: "Công nghệ"), map sang đúng
      if (!headByBaseSubject[baseName]) headByBaseSubject[baseName] = [];
      headByBaseSubject[baseName].push({ id: head.id, full_name: head.full_name });
    }

    const { rows: existingTeachers } = await client.query("SELECT id, full_name FROM users WHERE role = 'teacher'");
    
    const hash = await bcrypt.hash('123456', 10);
    const teachersByBaseSubject = {};
    const teacherBaseSubjectMap = {};
    let allNewTeachers = [];
    let existingTeacherIdx = 0;

    for (const bs of baseSubjects) {
      const needed = targetTeachersPerBase[bs];
      teachersByBaseSubject[bs] = [];

      // Đưa tổ trưởng có môn phù hợp vào pool trước
      const headsForSubject = headByBaseSubject[bs] || [];
      for (const head of headsForSubject) {
        teachersByBaseSubject[bs].push(head.id);
        teacherBaseSubjectMap[head.id] = bs;
        allNewTeachers.push(head);
      }

      // Thêm giáo viên thường cho đủ số lượng (trừ số tổ trưởng đã có)
      const extraNeeded = needed - headsForSubject.length;
      for (let i = 0; i < extraNeeded; i++) {
        if (existingTeacherIdx < existingTeachers.length) {
          const t = existingTeachers[existingTeacherIdx++];
          teachersByBaseSubject[bs].push(t.id);
          teacherBaseSubjectMap[t.id] = bs;
          allNewTeachers.push(t);
        } else {
          const fullName = randomName();
          const email = `${removeAccents(fullName)}${Date.now() + i}@thpt.edu.vn`;
          const res = await client.query(
            `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'teacher') RETURNING id, full_name`,
            [fullName, email, hash]
          );
          const tId = res.rows[0].id;
          teachersByBaseSubject[bs].push(tId);
          teacherBaseSubjectMap[tId] = bs;
          allNewTeachers.push(res.rows[0]);
        }
      }
    }

    console.log(`Đã phân bổ lại ${allNewTeachers.length} giáo viên (Dùng lại ${existingTeacherIdx} cũ, tạo mới ${allNewTeachers.length - existingTeacherIdx}).`);

    // Phân công khối lớp (teacherGrades)
    const teacherGrades = {};
    for (const t of allNewTeachers) {
      teacherGrades[t.id] = new Set();
    }

    // Phân công 1 khối cho mỗi giáo viên
    for (const baseName of baseSubjects) {
      const eligibleTeachers = teachersByBaseSubject[baseName] || [];
      if (eligibleTeachers.length === 0) continue;

      let tIndex = 0;
      for (const grade of [10, 11, 12]) {
        const needed = targetTeachersPerBaseGrade[baseName][grade] || 0;
        for (let i = 0; i < needed; i++) {
          if (tIndex < eligibleTeachers.length) {
            teacherGrades[eligibleTeachers[tIndex]].add(grade);
            tIndex++;
          }
        }
      }
    }

    // Phân công class_subjects (liền kề nhau)
    const teacherLoad = {};
    for (const t of allNewTeachers) teacherLoad[t.id] = 0;

    let assignedCount = 0;

    for (const baseName of baseSubjects) {
      const eligibleTeachers = teachersByBaseSubject[baseName] || [];
      if (eligibleTeachers.length === 0) continue;

      for (const grade of [10, 11, 12]) {
        const baseSubList = subjects.filter(s => s.name.startsWith(baseName) && s.grade === grade);
        if (baseSubList.length === 0) continue;
        const sub = baseSubList[0];

        // Lấy tất cả lớp của khối này cần học môn này
        const neededClasses = classes.filter(c => c.grade === grade && classCombinations[c.id].includes(sub.id));
        // Sắp xếp lớp học theo tên để đảm bảo tính liền kề (T1, T2, T3...)
        neededClasses.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        const teachersForGrade = eligibleTeachers.filter(tId => teacherGrades[tId].has(grade));
        if (teachersForGrade.length === 0) continue;

        // Phân bổ tuần tự
        const classesPerTeacher = Math.ceil(neededClasses.length / teachersForGrade.length);
        for (let i = 0; i < neededClasses.length; i++) {
          const cls = neededClasses[i];
          const tIndex = Math.floor(i / classesPerTeacher);
          const chosenTeacherId = teachersForGrade[Math.min(tIndex, teachersForGrade.length - 1)];

          await client.query(
            'INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES ($1, $2, $3)',
            [cls.id, sub.id, chosenTeacherId]
          );
          teacherLoad[chosenTeacherId]++;
          assignedCount++;
        }
      }
    }

    console.log(`Đã phân công ${assignedCount} lớp học phần liền kề.`);

    // Insert vào teacher_subjects dựa trên các khối thực tế (cho cả giáo viên và tổ trưởng)
    for (const t of allNewTeachers) {
      const bs = teacherBaseSubjectMap[t.id];
      if (!bs) continue;
      const grades = Array.from(teacherGrades[t.id]);
      if (grades.length === 0) continue;

      const matchingSubjects = subjects.filter(s => s.name.startsWith(bs) && grades.includes(s.grade));
      for (const ms of matchingSubjects) {
        // Dùng ON CONFLICT DO NOTHING để bỏ qua nếu đã tồn tại
        await client.query(
          'INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [t.id, ms.id]
        );
      }
    }

    // Thống kê tải
    console.log('\n--- Thống kê phân công giáo viên ---');
    for (const t of allNewTeachers) {
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

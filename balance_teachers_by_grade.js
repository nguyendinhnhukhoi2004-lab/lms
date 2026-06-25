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
    await client.query('BEGIN');
    console.log('Fetching data...');
    
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    const { rows: classes } = await client.query('SELECT * FROM classes');
    const { rows: teachers } = await client.query(`SELECT id FROM users WHERE role IN ('teacher', 'department_head')`);
    const { rows: teacherSubjects } = await client.query(`
      SELECT ts.teacher_id, s.name as subject_name 
      FROM teacher_subjects ts 
      JOIN subjects s ON ts.subject_id = s.id
    `);
    const { rows: headSubjects } = await client.query(`
      SELECT head_id as teacher_id, subject_name 
      FROM head_subjects
    `);
    
    // Determine base subject for each teacher
    const teacherBase = {};
    for (const ts of teacherSubjects) {
      const baseName = ts.subject_name.replace(/ \d+$/, '');
      if (!teacherBase[ts.teacher_id]) teacherBase[ts.teacher_id] = baseName;
    }
    for (const hs of headSubjects) {
      const baseName = hs.subject_name.replace(/ \d+$/, '');
      if (!teacherBase[hs.teacher_id]) teacherBase[hs.teacher_id] = baseName;
    }
    for (const t of teachers) {
      if (!teacherBase[t.id]) teacherBase[t.id] = "Toán"; 
    }

    // Clean up current assignments
    await client.query('DELETE FROM class_subjects');
    
    const teacherLoad = {};
    const teacherGrades = {};
    for (const t of teachers) {
      teacherLoad[t.id] = 0;
      teacherGrades[t.id] = new Set();
    }

    let classCombinations = {}; // class_id -> array of subject_ids
    for (const cls of classes) {
      const grade = cls.grade;
      const gradeSubjects = subjects.filter(s => s.grade === grade);
      const compulsory = gradeSubjects.filter(s => s.category === 'bat_buoc');
      
      let combo = [];
      // Half classes KHTN, half KHXH based on name (e.g. A1-A6 = KHTN, A7-A12 = KHXH)
      const num = parseInt(cls.name.replace(/\D/g, '')) || 1;
      if (num <= 6) {
        combo = gradeSubjects.filter(s => s.category === 'khtn' || s.name.includes('Tin học'));
      } else {
        combo = gradeSubjects.filter(s => s.category === 'khxh' || s.name.includes('Tin học'));
      }
      
      classCombinations[cls.id] = [...compulsory.map(s => s.id), ...combo.map(s => s.id)];
    }

    // For each subject, gather all classes that need it
    for (const sub of subjects) {
      const baseName = sub.name.replace(/ \d+$/, '');
      const grade = sub.grade;
      const neededClasses = classes.filter(c => classCombinations[c.id].includes(sub.id));
      
      if (neededClasses.length === 0) continue;

      let eligibleTeachers = Object.keys(teacherBase).filter(tId => teacherBase[tId] === baseName);

      // Distribute
      let tIndex = 0;
      for (const cls of neededClasses) {
        // Find a teacher
        let attempts = 0;
        let tId = eligibleTeachers[tIndex % eligibleTeachers.length];
        
        while ((teacherLoad[tId] >= 6 || (teacherGrades[tId].size >= 2 && !teacherGrades[tId].has(grade))) && attempts < eligibleTeachers.length) {
          tIndex++;
          tId = eligibleTeachers[tIndex % eligibleTeachers.length];
          attempts++;
        }

        // If no teacher found (all full), just use the first eligible and ignore constraints for now, or create new.
        // For simplicity we just assign to the first eligible.
        if (attempts >= eligibleTeachers.length) {
          tId = eligibleTeachers[0];
        }

        await client.query(`INSERT INTO class_subjects (class_id, subject_id, teacher_id) VALUES ($1, $2, $3)`, [cls.id, sub.id, tId]);
        teacherLoad[tId]++;
        teacherGrades[tId].add(grade);
        
        tIndex++;
      }
    }
    
    // --- Phân công Giáo viên chủ nhiệm ---
    let teacherIndex = 0;
    for (const cls of classes) {
      if (teacherIndex < teachers.length) {
        await client.query('UPDATE classes SET homeroom_teacher_id = $1 WHERE id = $2', [teachers[teacherIndex].id, cls.id]);
        teacherIndex++;
      } else {
        // If we ran out of teachers for some reason, loop back
        await client.query('UPDATE classes SET homeroom_teacher_id = $1 WHERE id = $2', [teachers[teacherIndex % teachers.length].id, cls.id]);
        teacherIndex++;
      }
    }

    await client.query('COMMIT');
    console.log('Đã phân công môn học và giáo viên chủ nhiệm thành công cho các lớp hành chính.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();

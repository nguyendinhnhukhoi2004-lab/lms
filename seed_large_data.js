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

    // 1. Fetch subjects
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    
    // Groups by grade
    const subjectsByGrade = { 10: [], 11: [], 12: [] };
    subjects.forEach(s => {
      if (subjectsByGrade[s.grade]) subjectsByGrade[s.grade].push(s);
    });

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
    console.log('Creating classes...');
    const createdClasses = [];
    for (const grade of [10, 11, 12]) {
      for (let i = 1; i <= 10; i++) {
        const className = `${grade}A${i}`;
        const res = await client.query(
          `INSERT INTO classes (name, grade, school_year) VALUES ($1, $2, $3) RETURNING id, name, grade`,
          [className, grade, '2023-2024']
        );
        createdClasses.push(res.rows[0]);
      }
    }

    // 4. Create students and student_subjects
    console.log('Creating students...');
    const hash = await bcrypt.hash('123456', 10);
    const createdStudents = [];
    
    for (const cls of createdClasses) {
      for (let i = 1; i <= 40; i++) {
        const fullName = `Học sinh ${cls.name} - ${i}`;
        const email = `hs${cls.name.toLowerCase()}_${i}@thpt.edu.vn`;
        
        const res = await client.query(
          `INSERT INTO users (full_name, email, password_hash, role, class_id) 
           VALUES ($1, $2, $3, 'student', $4) RETURNING id`,
          [fullName, email, hash, cls.id]
        );
        const studentId = res.rows[0].id;
        createdStudents.push({ id: studentId, grade: cls.grade });

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
    const createdModuleClasses = []; // { id, subject_id, grade, capacity }
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
          [sub.id, tId, mcName, '2023-2024']
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
    console.log('Successfully seeded large database!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error seeding:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();

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
    
    console.log('Clearing existing module classes for 2025-2026...');
    await client.query(`DELETE FROM student_module_classes WHERE module_class_id IN (SELECT id FROM module_classes WHERE school_year = '2025-2026')`);
    await client.query(`DELETE FROM module_classes WHERE school_year = '2025-2026'`);

    console.log('Fetching required data...');
    const { rows: subjects } = await client.query('SELECT * FROM subjects');
    const { rows: teachers } = await client.query(`SELECT * FROM users WHERE role='teacher'`);
    const { rows: teacherSubjects } = await client.query('SELECT * FROM teacher_subjects');

    if (teachers.length === 0) throw new Error('No teachers found');

    const MAX_STUDENTS_PER_CLASS = 38; // About 35-40

    console.log('Re-creating module classes...');
    let totalModuleClasses = 0;

    for (const sub of subjects) {
      // Find students who registered for this subject
      const { rows: regSt } = await client.query(`SELECT student_id FROM student_subjects WHERE subject_id = $1`, [sub.id]);
      const registeredIds = regSt.map(r => r.student_id);

      if (registeredIds.length === 0) continue;

      // Find eligible teachers
      const eligibleTeacherIds = teacherSubjects.filter(ts => ts.subject_id === sub.id).map(ts => ts.teacher_id);

      // Determine number of module classes needed
      const numClasses = Math.ceil(registeredIds.length / MAX_STUDENTS_PER_CLASS);
      const studentsPerClass = Math.ceil(registeredIds.length / numClasses);

      let studentIndex = 0;
      let teacherIndex = 0;

      for (let i = 1; i <= numClasses; i++) {
        // Pick a teacher: round-robin among eligible teachers, or random fallback
        let tId;
        if (eligibleTeacherIds.length > 0) {
          tId = eligibleTeacherIds[teacherIndex % eligibleTeacherIds.length];
          teacherIndex++;
        } else {
          tId = teachers[Math.floor(Math.random() * teachers.length)].id;
        }

        const mcName = `${sub.name} - Lớp HP ${i}`;
        const mcRes = await client.query(
          `INSERT INTO module_classes (subject_id, teacher_id, name, school_year) VALUES ($1, $2, $3, $4) RETURNING id`,
          [sub.id, tId, mcName, '2025-2026']
        );
        const mcId = mcRes.rows[0].id;
        totalModuleClasses++;

        // Assign students to this class
        const myStudents = registeredIds.slice(studentIndex, studentIndex + studentsPerClass);
        studentIndex += studentsPerClass;

        for (const stId of myStudents) {
          await client.query(
            `INSERT INTO student_module_classes (student_id, module_class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [stId, mcId]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log(`Successfully created ${totalModuleClasses} module classes with max ${MAX_STUDENTS_PER_CLASS} students per class.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();

const { query } = require('./src/config/db');

(async () => {
  try {
    const students = [
      'd1000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000002',
      'd1000000-0000-0000-0000-000000000003'
    ];
    for (const student of students) {
      const res = await query('SELECT id, status, schedule_id, student_id, submitted_at FROM submissions WHERE student_id=$1', [student]);
      console.log('STUDENT', student, JSON.stringify(res.rows, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();

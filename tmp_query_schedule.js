const { query } = require('./src/config/db');

(async () => {
  try {
    const res = await query('SELECT * FROM exam_schedules WHERE id=$1', ['bd954fa6-6425-40ab-9c22-fa5c908f0d9c']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();

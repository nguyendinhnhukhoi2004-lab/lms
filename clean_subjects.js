const { Pool } = require('pg');
require('dotenv').config();

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
    const subjectsToRemove = [
      'Mỹ thuật', 'Âm nhạc', 'GD Thể chất', 'GD QPAN', 'Hoạt động TN-HN', 'Giáo dục địa phương'
    ];
    
    let deletedCount = 0;
    for (const sub of subjectsToRemove) {
      const res = await client.query('DELETE FROM subjects WHERE name ILIKE $1', [`%${sub}%`]);
      deletedCount += res.rowCount;
    }
    
    console.log(`Successfully deleted ${deletedCount} subjects and all their references (module classes, enrollments, etc.)`);
  } catch (err) {
    console.error('Error deleting:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();

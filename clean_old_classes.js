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
    
    // Tìm các lớp cũ
    const { rows: oldClasses } = await client.query(`SELECT id, name FROM classes WHERE school_year != '2025-2026' OR school_year IS NULL`);
    
    if (oldClasses.length === 0) {
      console.log('Không có lớp cũ nào để xóa.');
      return;
    }
    
    const oldClassIds = oldClasses.map(c => c.id);
    
    console.log(`Tìm thấy ${oldClasses.length} lớp cũ. Đang xóa dữ liệu liên quan...`);
    
    // Xóa exam_schedules liên quan đến các lớp cũ
    await client.query(`DELETE FROM exam_schedules WHERE class_id = ANY($1::uuid[])`, [oldClassIds]);
    
    // Tìm và xóa học sinh thuộc các lớp cũ
    await client.query(`DELETE FROM users WHERE class_id = ANY($1::uuid[])`, [oldClassIds]);
    
    // Cuối cùng xóa lớp
    await client.query(`DELETE FROM classes WHERE id = ANY($1::uuid[])`, [oldClassIds]);
    
    await client.query('COMMIT');
    console.log(`Đã xóa thành công ${oldClasses.length} lớp cũ và toàn bộ dữ liệu liên quan.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi xóa lớp cũ:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();

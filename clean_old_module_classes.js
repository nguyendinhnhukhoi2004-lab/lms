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
    
    // Tìm các lớp học phần cũ
    const { rows: oldModuleClasses } = await client.query(`SELECT id FROM module_classes WHERE school_year != '2025-2026' OR school_year IS NULL`);
    
    if (oldModuleClasses.length === 0) {
      console.log('Không có lớp học phần cũ nào để xóa.');
      return;
    }
    
    const oldModuleClassIds = oldModuleClasses.map(c => c.id);
    console.log(`Tìm thấy ${oldModuleClasses.length} lớp học phần cũ. Đang tiến hành xóa...`);
    
    // Xóa chính lớp học phần (student_module_classes sẽ tự động bị xóa theo vì ON DELETE CASCADE)
    await client.query(`DELETE FROM module_classes WHERE id = ANY($1::uuid[])`, [oldModuleClassIds]);
    
    await client.query('COMMIT');
    console.log(`Đã xóa thành công ${oldModuleClasses.length} lớp học phần cũ.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi xóa lớp học phần cũ:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();

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
    const { rows } = await client.query('SELECT id, name, category, grade FROM subjects ORDER BY grade, category, name');
    console.table(rows);
  } finally {
    client.release();
    pool.end();
  }
}

run();

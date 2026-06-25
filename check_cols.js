require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: 'khoi05112004', database: 'exam_system' });
pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='questions' ORDER BY ordinal_position")
  .then(r => { r.rows.forEach(x => console.log(x.column_name, '-', x.data_type)); pool.end(); });

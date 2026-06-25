const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', password: 'khoi05112004', database: 'exam_system' });
pool.query("SELECT id, options, correct_answer FROM questions WHERE type='multiple_choice' LIMIT 5")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); });

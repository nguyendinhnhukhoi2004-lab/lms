const { query } = require('./src/config/db');
async function run() {
  const { rows } = await query(`
    SELECT u.id, u.full_name, u.role, c.name AS class_name 
    FROM users u 
    LEFT JOIN classes c ON u.class_id = c.id 
    WHERE u.role = 'student' 
    ORDER BY c.name ASC, u.full_name ASC 
    LIMIT 20 OFFSET 0
  `);
  console.log('Students:', rows.length);
}
run().catch(console.error).finally(() => process.exit(0));

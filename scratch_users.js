const { query } = require('./src/config/db');
(async () => {
  try {
    const { rows } = await query("SELECT id, email, role, full_name FROM users WHERE role = 'department_head'");
    console.log("Department Heads:", JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();

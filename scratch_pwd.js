const bcrypt = require('bcryptjs');
const { query } = require('./src/config/db');

(async () => {
  try {
    const { rows } = await query("SELECT email, password_hash FROM users WHERE role = 'department_head' LIMIT 1");
    const user = rows[0];
    const isMatch = await bcrypt.compare('password123', user.password_hash);
    console.log(`Email: ${user.email}, isMatch 'password123': ${isMatch}`);
    
    // Nếu cần, reset thử 1 mk
    // const hash = await bcrypt.hash('password123', 10);
    // await query("UPDATE users SET password_hash = $1 WHERE role = 'department_head'", [hash]);
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();

const { query } = require('./src/config/db');

(async () => {
  try {
    const res = await query('SELECT * FROM submissions WHERE id=$1', ['862ae59e-35b6-4f81-95db-b1390bd595b5']);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
})();

const { getClient } = require('./src/config/db');
(async () => {
  const client = await getClient();
  try {
    await client.query("ALTER TYPE question_type ADD VALUE 'short_answer'");
    console.log('Successfully added short_answer to question_type ENUM.');
  } catch (err) {
    if (err.code === '42710') {
      console.log('Value short_answer already exists in ENUM.');
    } else {
      console.error('Error altering ENUM:', err);
    }
  } finally {
    client.release();
    process.exit(0);
  }
})();

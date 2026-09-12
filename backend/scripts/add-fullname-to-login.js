require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  await pool.query(`ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS full_name VARCHAR(120);`);
  console.log('full_name column added to login_attempts.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
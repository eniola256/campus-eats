require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);
  await pool.query(`ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);`);
  console.log('password_hash columns added.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
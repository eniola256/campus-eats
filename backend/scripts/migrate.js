// Runs schema.sql against DATABASE_URL. Safe to re-run only on a fresh DB —
// this is a simple V1 migrator, not a versioned migration system.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Schema applied.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

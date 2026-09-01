require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../src/db/seed.sql'), 'utf8');
  await pool.query(sql);
  console.log('Seed data inserted.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

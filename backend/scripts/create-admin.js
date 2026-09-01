// Creates (or updates) an admin login.
// Usage: node scripts/create-admin.js "Eniola" admin@campuseats.local yourStrongPassword
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db/pool');

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: node scripts/create-admin.js "Full Name" email@example.com password');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO admin_users (name, email, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [name, email, hash]
  );
  console.log(`Admin account ready for ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

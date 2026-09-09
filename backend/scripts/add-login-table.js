require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id            SERIAL PRIMARY KEY,
      phone         VARCHAR(20) NOT NULL,
      login_token   VARCHAR(64) NOT NULL UNIQUE,
      confirmed_at  TIMESTAMPTZ,
      session_token VARCHAR(64) UNIQUE,
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_token ON login_attempts(login_token);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_session ON login_attempts(session_token);`);
  console.log('login_attempts table ready.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
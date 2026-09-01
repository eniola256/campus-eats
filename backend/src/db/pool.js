const { Pool } = require('pg');

// Single shared connection pool for the whole backend.
// DATABASE_URL example: postgres://user:password@localhost:5432/campus_eats
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

module.exports = pool;

require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);`);
  console.log('orders.shop_id ready.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

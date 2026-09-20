require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shops (
      id            SERIAL PRIMARY KEY,
      name          VARCHAR(150) NOT NULL,
      description   TEXT,
      image_url     TEXT,
      rating        NUMERIC(2,1),      -- manual for now; real aggregated ratings are a future feature
      is_active     BOOLEAN NOT NULL DEFAULT true,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id INTEGER REFERENCES shops(id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);`);
  console.log('shops table and products.shop_id ready.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

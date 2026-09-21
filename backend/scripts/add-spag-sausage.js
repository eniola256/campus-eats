// Adds the "Spag + Sausage" item to Fuck "U" Spag — a genuinely new
// product, not an update to an existing one. Safe to re-run: it checks
// for an existing row with this exact name+shop first, so running it
// twice won't create a duplicate.
require('dotenv').config();
const pool = require('../src/db/pool');

async function main() {
  const { rows: shopRows } = await pool.query(
    `SELECT id FROM shops WHERE name = $1`,
    ['Fuck "U" Spag']
  );
  if (shopRows.length === 0) {
    throw new Error('Shop "Fuck \"U\" Spag" not found — check the name matches exactly.');
  }
  const shopId = shopRows[0].id;

  const { rows: existing } = await pool.query(
    `SELECT id FROM products WHERE name = $1 AND shop_id = $2`,
    ['Spag + Sausage', shopId]
  );
  if (existing.length > 0) {
    console.log('Already exists — no change made.');
    await pool.end();
    return;
  }

  await pool.query(
    `INSERT INTO products (name, category, price_kobo, shop_id, image_url, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    ['Spag + Sausage', 'Spaghetti Meals', 120000, shopId, '/spag+sausage.png', 20]
  );
  console.log('Added "Spag + Sausage" (₦1,200) to Fuck "U" Spag.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

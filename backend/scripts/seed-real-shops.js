// Seeds the real shops and their real menus. Safe to re-run — it clears
// out any previously seeded shops/products from THIS script only
// (matched by name) before re-inserting, so you can tweak this file and
// re-run it as prices get confirmed/corrected.
require('dotenv').config();
const pool = require('../src/db/pool');

const SHOPS = [
  {
    name: 'Food Affairs (Cocacola)',
    rating: 4.6,
    image_url: '/shop1.png',
    items: [
      { category: 'Main Meals', name: 'Rice', price_kobo: 30000 },
      { category: 'Main Meals', name: 'Beans', price_kobo: 20000, description: '₦200–₦300 depending on portion' },
      { category: 'Main Meals', name: 'Fufu & Soup', price_kobo: 120000, description: 'With any swallow' },
      { category: 'Main Meals', name: 'Spag', price_kobo: 20000, description: 'From ₦200, price may vary' },
      { category: 'Sides', name: 'Meat', price_kobo: 30000 },
      { category: 'Sides', name: 'Egg', price_kobo: 30000 },
      { category: 'Sides', name: 'Pomo', price_kobo: 20000 },
      { category: 'Sides', name: 'Plantain', price_kobo: 10000, description: 'From ₦100, price may vary' },
    ],
  },
  {
    name: 'Fuck "U" Spag',
    rating: 4.3,
    image_url: '/shop2.png',
    items: [
      { category: 'Spaghetti Meals', name: 'Spag + Fish + Takeaway', price_kobo: 120000 },
      { category: 'Spaghetti Meals', name: 'Spag + Fish + Egg', price_kobo: 150000 },
      { category: 'Spaghetti Meals', name: 'Spag + Plantain + Fish + Egg', price_kobo: 170000 },
      { category: 'Spaghetti Meals', name: 'Chicken + Spag', price_kobo: 270000, description: 'With takeaway' },
      { category: 'Spaghetti Meals', name: 'Turkey + Spag', price_kobo: 400000, description: 'With takeaway — please confirm this price' },
      { category: 'Extras', name: 'Spag Ala', price_kobo: 70000 },
      { category: 'Extras', name: 'Extra Spag', price_kobo: 50000 },
      { category: 'Extras', name: 'Plantain', price_kobo: 20000, description: '5 pieces' },
      { category: 'Extras', name: 'Sausage', price_kobo: 80000 },
      { category: 'Extras', name: 'Fish', price_kobo: 50000, description: '₦500–₦600' },
      { category: 'Extras', name: 'Egg', price_kobo: 30000 },
    ],
  },
  {
    name: 'Precious Royal Catering (Barwa)',
    rating: 4.8,
    image_url: '/shop3.png',
    items: [
      { category: 'Swallows', name: 'Fufu', price_kobo: 30000 },
      { category: 'Swallows', name: 'EBA', price_kobo: 20000 },
      { category: 'Swallows', name: 'Semo', price_kobo: 30000 },
      { category: 'Swallows', name: 'Pounded Yam', price_kobo: 50000 },
      { category: 'Proteins', name: 'Fish', price_kobo: 30000, description: '₦300–₦500' },
      { category: 'Proteins', name: 'Meat', price_kobo: 20000, description: '₦200–₦500' },
      { category: 'Sides', name: 'Pomo', price_kobo: 20000 },
      { category: 'Main Meals', name: 'Beans', price_kobo: 30000, description: 'Per portion' },
      { category: 'Main Meals', name: 'Rice', price_kobo: 30000, description: 'Per portion' },
      { category: 'Sides', name: 'Egg', price_kobo: 30000 },
      { category: 'Sides', name: 'Plantain', price_kobo: 20000, description: '5 pieces' },
      { category: 'Main Meals', name: 'Spaghetti', price_kobo: 20000, description: 'Per portion' },
    ],
  },
];

async function main() {
  for (const shop of SHOPS) {
    // Remove any previous seed of this exact shop (by name) so re-running
    // this script after editing prices doesn't create duplicates.
    const { rows: existing } = await pool.query('SELECT id FROM shops WHERE name = $1', [shop.name]);
    if (existing.length > 0) {
      await pool.query('DELETE FROM products WHERE shop_id = $1', [existing[0].id]);
      await pool.query('DELETE FROM shops WHERE id = $1', [existing[0].id]);
    }

    const { rows } = await pool.query(
      `INSERT INTO shops (name, rating, image_url) VALUES ($1, $2, $3) RETURNING id`,
      [shop.name, shop.rating, shop.image_url]
    );
    const shopId = rows[0].id;

    for (const [i, item] of shop.items.entries()) {
      await pool.query(
        `INSERT INTO products (name, category, description, price_kobo, shop_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.name, item.category, item.description || null, item.price_kobo, shopId, i]
      );
    }
    console.log(`Seeded "${shop.name}" with ${shop.items.length} items.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

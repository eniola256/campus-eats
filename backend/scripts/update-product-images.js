// Sets image_url on EXISTING products, matched by shop name + product
// name. Deliberately update-only — never deletes or recreates rows, so
// it can't break any order that already references these products.
// Safe to re-run any time you add or correct an image mapping.
require('dotenv').config();
const pool = require('../src/db/pool');

const IMAGE_MAP = [
  { shop: 'Food Affairs (Cocacola)', product: 'Rice', image: '/whiterice.png' },
  { shop: 'Food Affairs (Cocacola)', product: 'Beans', image: '/beans.png' },
  { shop: 'Food Affairs (Cocacola)', product: 'Fufu & Soup', image: '/fufu.png' },
  { shop: 'Food Affairs (Cocacola)', product: 'Spag', image: '/white-spag.png' },
  { shop: 'Food Affairs (Cocacola)', product: 'Meat', image: '/meat.png' },
  { shop: 'Food Affairs (Cocacola)', product: 'Egg', image: '/egg.png' },

  { shop: 'Fuck "U" Spag', product: 'Spag + Fish + Egg', image: '/egg+fish+spag.png' },
  { shop: 'Fuck "U" Spag', product: 'Spag + Plantain + Fish + Egg', image: '/egg+fish+spag.png' },
  { shop: 'Fuck "U" Spag', product: 'Chicken + Spag', image: '/spag+chicken.png' },
  { shop: 'Fuck "U" Spag', product: 'Sausage', image: '/sausage.png' },
  { shop: 'Fuck "U" Spag', product: 'Fish', image: '/fish.png' },
  { shop: 'Fuck "U" Spag', product: 'Egg', image: '/egg.png' },

  { shop: 'Precious Royal Catering (Barwa)', product: 'Fufu', image: '/fufu.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'EBA', image: '/eba.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Semo', image: '/semo.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Fish', image: '/fish.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Meat', image: '/meat.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Beans', image: '/beans.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Rice', image: '/jollofrice.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Egg', image: '/egg.png' },
  { shop: 'Precious Royal Catering (Barwa)', product: 'Spaghetti', image: '/white-spag.png' },
];

async function main() {
  let updated = 0;
  for (const row of IMAGE_MAP) {
    const result = await pool.query(
      `UPDATE products SET image_url = $1
       WHERE name = $2 AND shop_id = (SELECT id FROM shops WHERE name = $3)`,
      [row.image, row.product, row.shop]
    );
    if (result.rowCount === 0) {
      console.log(`No match for "${row.product}" at "${row.shop}" — check spelling against the DB.`);
    } else {
      updated += result.rowCount;
    }
  }
  console.log(`Done. ${updated} product(s) updated with an image.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

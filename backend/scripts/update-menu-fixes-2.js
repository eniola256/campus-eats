// A batch of small menu corrections: new images, a rename, and removing
// one item. Safe to re-run.
require('dotenv').config();
const pool = require('../src/db/pool');

const FOOD_AFFAIRS = 'Food Affairs (Cocacola)';
const FUS = 'Fuck "U" Spag';
const PRC = 'Precious Royal Catering (Barwa)';

async function setImage(shopName, productName, image) {
  const result = await pool.query(
    `UPDATE products SET image_url = $1
     WHERE name = $2 AND shop_id = (SELECT id FROM shops WHERE name = $3)`,
    [image, productName, shopName]
  );
  if (result.rowCount === 0) {
    console.log(`No match for "${productName}" at "${shopName}" — check spelling against the DB.`);
  } else {
    console.log(`Image set: "${productName}" (${shopName}) -> ${image}`);
  }
}

async function main() {
  // --- New images for existing items ---
  await setImage(FUS, 'Spag + Plantain + Fish + Egg', '/spag+plantain+fish+egg.png');
  await setImage(FUS, 'Turkey + Spag', '/spag+turkey.png');
  await setImage(FUS, 'Extra Spag', '/extra-spag.png');
  await setImage(PRC, 'Pounded Yam', '/pouded-yam.png'); // matches the actual uploaded filename
  await setImage(FOOD_AFFAIRS, 'Plantain', '/plantain.png');
  await setImage(FUS, 'Plantain', '/plantain.png');
  await setImage(PRC, 'Plantain', '/plantain.png');
  await setImage(FOOD_AFFAIRS, 'Pomo', '/pomo.png');
  await setImage(PRC, 'Pomo', '/pomo.png');

  // --- Rename "Spag + Fish + Takeaway" -> "Spag + Fish", with its new image ---
  const renameResult = await pool.query(
    `UPDATE products SET name = $1, image_url = $2
     WHERE name = $3 AND shop_id = (SELECT id FROM shops WHERE name = $4)`,
    ['Spag + Fish', '/spag+fish.png', 'Spag + Fish + Takeaway', FUS]
  );
  if (renameResult.rowCount === 0) {
    console.log('No match for "Spag + Fish + Takeaway" to rename — check spelling against the DB.');
  } else {
    console.log('Renamed "Spag + Fish + Takeaway" -> "Spag + Fish" and set its image.');
  }

  // --- Remove "Spag Ala" from Fuck "U" Spag ---
  const { rows: itemRows } = await pool.query(
    `SELECT id FROM products WHERE name = 'Spag Ala' AND shop_id = (SELECT id FROM shops WHERE name = $1)`,
    [FUS]
  );
  if (itemRows.length === 0) {
    console.log('"Spag Ala" not found — nothing to remove (may already be removed).');
  } else {
    const productId = itemRows[0].id;
    try {
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);
      console.log('"Spag Ala" permanently deleted (no past orders reference it).');
    } catch (err) {
      if (err.code === '23503') {
        // Foreign key violation — at least one past order references this
        // product. Hide it instead of breaking that order's history.
        await pool.query('UPDATE products SET is_available = false WHERE id = $1', [productId]);
        console.log('"Spag Ala" is referenced by an existing order, so it was hidden from the live menu instead of deleted (this keeps that order\'s history intact).');
      } else {
        throw err;
      }
    }
  }

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

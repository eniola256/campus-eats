const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/products?shopId=2 — public menu. shopId is optional; without
// it, this returns every available product across every shop (kept for
// backward compatibility with anything still expecting the old
// single-shop behavior).
router.get('/', async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const { rows } = await pool.query(
      `SELECT id, name, category, description, price_kobo, image_url, sort_order, shop_id
       FROM products
       WHERE is_available = true
         AND ($1::int IS NULL OR shop_id = $1)
       ORDER BY category, sort_order`,
      [shopId || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
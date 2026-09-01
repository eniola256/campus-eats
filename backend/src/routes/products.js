const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/products — public menu, only available items, grouped is left to the frontend
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, category, description, price_kobo, image_url, sort_order
       FROM products WHERE is_available = true ORDER BY category, sort_order`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

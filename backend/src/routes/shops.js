const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/shops — public list of active shops, for the "choose a shop"
// screen. Replaces the hardcoded SHOPS array that used to live in
// Menu.jsx — this is now real data, editable without a code deploy.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, image_url, rating
       FROM shops WHERE is_active = true ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

const express = require('express');
const pool = require('../db/pool');
const { getStoreStatus } = require('../services/storeStatus');

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

// GET /api/shops/status — is the store open? { open, message }.
// Lives here so no new route has to be mounted in server.js.
router.get('/status', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await getStoreStatus());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
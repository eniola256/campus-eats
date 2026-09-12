const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');

const router = express.Router();

const LOGIN_EXPIRY_MINUTES = 10;

router.post('/start', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }

    const loginToken = crypto.randomBytes(20).toString('hex');;
    const expiresAt = new Date(Date.now() + LOGIN_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO login_attempts (phone, login_token, expires_at)
       VALUES ($1, $2, $3)`,
      [phone.trim(), loginToken, expiresAt]
    );

    res.status(201).json({
      loginToken,
      expiresInSeconds: LOGIN_EXPIRY_MINUTES * 60,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/status/:loginToken', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM login_attempts WHERE login_token = $1`,
      [req.params.loginToken]
    );
    const attempt = rows[0];

    if (!attempt) {
      return res.status(404).json({ status: 'not_found' });
    }
    if (new Date(attempt.expires_at) < new Date()) {
      return res.json({ status: 'expired' });
    }
    if (!attempt.confirmed_at) {
      return res.json({ status: 'pending' });
    }

    const { rows: customerRows } = await pool.query(
      `SELECT full_name, phone, hostel, room_or_gate FROM customers WHERE phone = $1`,
      [attempt.phone]
    );

    res.json({
      status: 'confirmed',
      sessionToken: attempt.session_token,
      customer: customerRows[0] || { phone: attempt.phone },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res) => {
  const header = req.headers.authorization || '';
  const sessionToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!sessionToken) return res.status(401).json({ error: 'Not logged in' });

  try {
    const { rows } = await pool.query(
      `SELECT phone FROM login_attempts WHERE session_token = $1 AND confirmed_at IS NOT NULL`,
      [sessionToken]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Session not found' });

    const { rows: customerRows } = await pool.query(
      `SELECT full_name, phone, hostel, room_or_gate FROM customers WHERE phone = $1`,
      [rows[0].phone]
    );
    res.json({ customer: customerRows[0] || { phone: rows[0].phone } });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.delete('/logout', async (req, res) => {
  const header = req.headers.authorization || '';
  const sessionToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (sessionToken) {
    await pool.query(
      `UPDATE login_attempts SET session_token = NULL WHERE session_token = $1`,
      [sessionToken]
    );
  }
  res.json({ ok: true });
});

module.exports = router;
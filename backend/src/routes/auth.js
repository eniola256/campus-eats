const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const router = express.Router();

const LOGIN_EXPIRY_MINUTES = 10;

// POST /api/auth/signup  { fullName, phone, password }
// Only used ONCE per customer. Doesn't create the account yet — first
// proves the phone is real via a Telegram tap, same handshake as before.
// The account is actually created in telegram.js's webhook, once confirmed.
router.post('/signup', async (req, res, next) => {
  try {
    const { fullName, phone, password } = req.body;
    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }
    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({ error: 'A name is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const loginToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + LOGIN_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO login_attempts (phone, full_name, password_hash, login_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [phone.trim(), fullName.trim(), passwordHash, loginToken, expiresAt]
    );

    res.status(201).json({
      loginToken,
      expiresInSeconds: LOGIN_EXPIRY_MINUTES * 60,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/status/:loginToken
// Polled while waiting on Telegram confirmation during signup.
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

// POST /api/auth/login  { phone, password }
// Every login after the first. No Telegram involved at all — just checks
// the password against the hash saved during signup.
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const { rows } = await pool.query(`SELECT * FROM customers WHERE phone = $1`, [phone.trim()]);
    const customer = rows[0];

    if (!customer || !customer.password_hash) {
      return res.status(401).json({ error: 'No account found for this phone number — try signing up.' });
    }

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Reuse the login_attempts table as a simple session store — a
    // password check IS the confirmation here, so we mark it confirmed
    // immediately instead of waiting on Telegram.
    const sessionToken = crypto.randomBytes(20).toString('hex');
    const throwawayLoginToken = crypto.randomBytes(20).toString('hex'); // never shown anywhere, just satisfies the unique column
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year — see note in CustomerAuthContext about session lifetime

    await pool.query(
      `INSERT INTO login_attempts (phone, login_token, confirmed_at, session_token, expires_at)
       VALUES ($1, $2, now(), $3, $4)`,
      [customer.phone, throwawayLoginToken, sessionToken, farFuture]
    );

    res.json({
      sessionToken,
      customer: {
        full_name: customer.full_name,
        phone: customer.phone,
        hostel: customer.hostel,
        room_or_gate: customer.room_or_gate,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — restores login state on page load from a saved
// session token.
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

// DELETE /api/auth/logout
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
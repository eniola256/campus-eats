const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

const router = express.Router();

const LOGIN_EXPIRY_MINUTES = 10;
const SESSION_EXPIRY_DAYS = 30;

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
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
    if (new Date(attempt.expires_at) < new Date() && !attempt.confirmed_at) {
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
//
// Security note: the error message is deliberately IDENTICAL whether the
// phone has no account or the password is just wrong. Distinguishing
// those would let someone quietly discover which phone numbers have
// accounts at all, just by trying to log in with them.
router.post('/login', async (req, res, next) => {
  const genericError = 'Invalid phone number or password.';
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const { rows } = await pool.query(`SELECT * FROM customers WHERE phone = $1`, [phone.trim()]);
    const customer = rows[0];

    if (!customer || !customer.password_hash) {
      return res.status(401).json({ error: genericError });
    }

    const valid = await bcrypt.compare(password, customer.password_hash);
    if (!valid) {
      return res.status(401).json({ error: genericError });
    }

    const sessionToken = crypto.randomBytes(20).toString('hex');
    const throwawayLoginToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO login_attempts (phone, login_token, confirmed_at, session_token, expires_at)
       VALUES ($1, $2, now(), $3, $4)`,
      [customer.phone, throwawayLoginToken, sessionToken, expiresAt]
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
// session token. Also enforces real expiry now (previously this only
// checked confirmed_at, meaning a session effectively never expired) —
// and slides the expiry forward on every successful check, so an
// actively-used session stays logged in indefinitely while an idle or
// stolen token eventually stops working on its own.
router.get('/me', async (req, res) => {
  const header = req.headers.authorization || '';
  const sessionToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!sessionToken) return res.status(401).json({ error: 'Not logged in' });

  try {
    const { rows } = await pool.query(
      `SELECT phone, expires_at FROM login_attempts
       WHERE session_token = $1 AND confirmed_at IS NOT NULL`,
      [sessionToken]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Session not found' });
    if (new Date(rows[0].expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const newExpiry = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await pool.query(`UPDATE login_attempts SET expires_at = $1 WHERE session_token = $2`, [newExpiry, sessionToken]);

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

// POST /api/auth/forgot-password  { phone, newPassword }
// Reuses the exact same Telegram-confirmation mechanism as signup — the
// webhook's existing "ON CONFLICT DO UPDATE SET password_hash = ..."
// logic already overwrites the password once confirmed, so nothing
// there needs to change.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { phone, newPassword } = req.body;
    if (!phone || phone.trim().length < 8) {
      return res.status(400).json({ error: 'A valid phone number is required' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { rows } = await pool.query(`SELECT phone FROM customers WHERE phone = $1`, [phone.trim()]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No account found for this phone number — try signing up instead.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const loginToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + LOGIN_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO login_attempts (phone, password_hash, login_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [phone.trim(), passwordHash, loginToken, expiresAt]
    );

    res.status(201).json({
      loginToken,
      expiresInSeconds: LOGIN_EXPIRY_MINUTES * 60,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
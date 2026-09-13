const pool = require('../db/pool');

// Protects customer-only routes (like "give me my orders"). Same pattern
// as requireAdmin, but checks a customer session_token in login_attempts
// instead of an admin JWT — these are two separate, deliberately
// unrelated auth systems (a customer session should never work on an
// admin route, or vice versa).
async function requireCustomer(req, res, next) {
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

    req.customerPhone = rows[0].phone;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
}

module.exports = { requireCustomer };
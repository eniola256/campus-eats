const pool = require('../db/pool');

// Store open/closed switch, kept in the app_settings table (key/value).
// Used by the public status route, the admin toggle, and order creation.

const DEFAULT_MESSAGE = "We're closed right now. Please check back soon.";

async function getStoreStatus() {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM app_settings WHERE key IN ('store_open', 'closed_message')`
    );
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      open: settings.store_open !== 'false',
      message: settings.closed_message || DEFAULT_MESSAGE,
    };
  } catch (err) {
    // If the lookup fails (table missing, database hiccup), treat the store
    // as open instead of locking every customer out by accident.
    console.error('Store status lookup failed, treating store as open:', err.message);
    return { open: true, message: DEFAULT_MESSAGE };
  }
}

// `message` is only saved when a string is passed, so re-opening the store
// leaves the last closed message alone.
async function setStoreStatus(open, message) {
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('store_open', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [open ? 'true' : 'false']
  );
  if (typeof message === 'string') {
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('closed_message', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [message]
    );
  }
}

module.exports = { getStoreStatus, setStoreStatus, DEFAULT_MESSAGE };

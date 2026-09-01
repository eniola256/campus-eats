const pool = require('../db/pool');

// Given a subtotal in kobo, return { serviceFeeKobo, deliveryFeeKobo } from
// the active fee_rules table. Falls back to the top tier if nothing matches
// (e.g. a very large order) and throws if the order is below the minimum.
const MIN_ORDER_KOBO = 150000; // ₦1,500

async function calculateFees(subtotalKobo) {
  if (subtotalKobo < MIN_ORDER_KOBO) {
    const err = new Error(`Minimum order is ₦${MIN_ORDER_KOBO / 100}`);
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `SELECT service_fee_kobo, delivery_fee_kobo
     FROM fee_rules
     WHERE active = true
       AND min_subtotal_kobo <= $1
       AND (max_subtotal_kobo IS NULL OR max_subtotal_kobo >= $1)
     ORDER BY min_subtotal_kobo DESC
     LIMIT 1`,
    [subtotalKobo]
  );

  if (rows.length === 0) {
    // No tier matched (shouldn't happen if tiers are seeded correctly) —
    // use the highest tier's fees as a safe default.
    const fallback = await pool.query(
      `SELECT service_fee_kobo, delivery_fee_kobo FROM fee_rules
       WHERE active = true ORDER BY min_subtotal_kobo DESC LIMIT 1`
    );
    return {
      serviceFeeKobo: fallback.rows[0]?.service_fee_kobo ?? 25000,
      deliveryFeeKobo: fallback.rows[0]?.delivery_fee_kobo ?? 30000,
    };
  }

  return {
    serviceFeeKobo: rows[0].service_fee_kobo,
    deliveryFeeKobo: rows[0].delivery_fee_kobo,
  };
}

module.exports = { calculateFees, MIN_ORDER_KOBO };

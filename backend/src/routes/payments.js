const express = require('express');
const pool = require('../db/pool');
const { verifyTransaction, isValidWebhookSignature } = require('../services/monnify');
const { notify } = require('../services/whatsapp');

const router = express.Router();

async function confirmPaymentByReference(reference, rawPayload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT o.id, o.status, o.total_kobo, o.delivery_hostel, c.full_name, c.phone
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE o.paystack_reference = $1
       FOR UPDATE`,
      [reference]
    );
    if (orderRows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'order_not_found' };
    }
    const order = orderRows[0];

    const { rows: existingPayment } = await client.query(
      `SELECT id FROM payments WHERE paystack_reference = $1 AND status = 'success'`,
      [reference]
    );
    if (existingPayment.length > 0 || order.status !== 'pending_payment') {
      await client.query('ROLLBACK');
      return { ok: true, alreadyProcessed: true };
    }

    await client.query(
      `INSERT INTO payments (order_id, paystack_reference, amount_kobo, status, raw_payload, verified_at)
       VALUES ($1, $2, $3, 'success', $4, now())
       ON CONFLICT (paystack_reference) DO UPDATE SET status = 'success', verified_at = now()`,
      [order.id, reference, order.total_kobo, rawPayload || {}]
    );

    await client.query(
      `UPDATE orders SET status = 'payment_confirmed', updated_at = now() WHERE id = $1`,
      [order.id]
    );
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, note)
       VALUES ($1, 'pending_payment', 'payment_confirmed', 'Monnify payment verified')`,
      [order.id]
    );

    await client.query('COMMIT');

    await notify('payment_confirmed', order.phone, {
      orderId: order.id,
      total: (order.total_kobo / 100).toLocaleString(),
    });

    return { ok: true, orderId: order.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// GET /api/payments/verify/:reference — convenience check after Monnify
// redirects the customer back. The webhook is still the real source of
// truth in case the browser closes before this fires.
//
// NOTE: 'PAID' is Monnify's success value based on best understanding of
// their docs — confirm this exact string against one real sandbox response
// before relying on it in production (temporarily log the raw `result`
// here to check).
router.get('/verify/:reference', async (req, res, next) => {
  try {
    const result = await verifyTransaction(req.params.reference);
    if (result?.paymentStatus !== 'PAID') {
      return res.status(400).json({ ok: false, status: result?.paymentStatus });
    }
    const outcome = await confirmPaymentByReference(req.params.reference, result);
    res.json(outcome);
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook — Monnify server-to-server event notification.
//
// CAVEAT: Monnify only sends the 'monnify-signature' header in PRODUCTION,
// not sandbox — so this signature check can't be exercised in testing the
// way Paystack's test cards let us. Also unconfirmed: exact webhook payload
// field names (eventType / eventData.paymentReference is best
// understanding) — log the raw payload once a real webhook arrives and
// adjust if needed.
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['monnify-signature'];
    const isProduction = process.env.MONNIFY_ENV === 'live';
    if (isProduction && !isValidWebhookSignature(req.body, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString('utf8'));
    console.log('Monnify webhook received:', JSON.stringify(event)); // temporary — remove once field names are confirmed

    if (event.eventType === 'SUCCESSFUL_TRANSACTION') {
      await confirmPaymentByReference(event.eventData.paymentReference, event.eventData);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

module.exports = router;

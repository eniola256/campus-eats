const express = require('express');
const pool = require('../db/pool');
const { verifyTransaction, isValidWebhookSignature } = require('../services/monnify');
const { notify, notifyAdmin } = require('../services/telegram');

const router = express.Router();

// Tell the admin a paid order just arrived. Runs after the payment is
// already saved, and swallows its own errors, so a Telegram or query
// problem can never undo or fail a payment confirmation.
async function pingAdminNewOrder(order) {
  try {
    const { rows: shopRows } = await pool.query(
      `SELECT s.name FROM orders o LEFT JOIN shops s ON s.id = o.shop_id WHERE o.id = $1`,
      [order.id]
    );
    const { rows: items } = await pool.query(
      `SELECT quantity, product_name FROM order_items WHERE order_id = $1 ORDER BY id`,
      [order.id]
    );
    await notifyAdmin('new_paid_order', {
      orderId: order.id,
      shopName: shopRows[0]?.name || 'Unknown shop',
      hostel: order.delivery_hostel,
      customerName: order.full_name,
      phone: order.phone,
      itemsText: items.map((i) => `${i.quantity}× ${i.product_name}`).join('\n'),
      total: (order.total_kobo / 100).toLocaleString(),
    });
  } catch (err) {
    console.error('Admin new-order ping failed:', err);
  }
}

async function confirmPaymentByReference(reference, rawPayload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: orderRows } = await client.query(
      `SELECT o.id, o.status, o.total_kobo, o.delivery_hostel, c.full_name, c.phone, c.telegram_chat_id
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

    await notify('payment_confirmed', order.telegram_chat_id, {
      orderId: order.id,
      total: (order.total_kobo / 100).toLocaleString(),
    });

    // Only reached the first time an order is confirmed: a repeat call
    // (webhook after verify, or the reverse) returns early above as
    // alreadyProcessed, so the admin gets exactly one ping per order.
    await pingAdminNewOrder(order);

    return { ok: true, orderId: order.id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

router.get('/verify/:reference', async (req, res, next) => {
  try {
    const result = await verifyTransaction(req.params.reference);
    console.log(`Verify check for ${req.params.reference}: paymentStatus=${result?.paymentStatus}`);
    if (result?.paymentStatus !== 'PAID') {
      const updateResult = await pool.query(
        `UPDATE orders SET status = 'payment_failed', updated_at = now()
         WHERE paystack_reference = $1 AND status = 'pending_payment'
         RETURNING id`,
        [req.params.reference]
      );
      console.log(`Marked payment_failed for ${req.params.reference}, rows updated: ${updateResult.rowCount}`);
      return res.status(400).json({ ok: false, status: result?.paymentStatus });
    }
    const outcome = await confirmPaymentByReference(req.params.reference, result);
    res.json(outcome);
  } catch (err) {
    console.error(`Verify check FAILED for ${req.params.reference}:`, err.message || err);
    next(err);
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['monnify-signature'];
    const isProduction = process.env.MONNIFY_ENV === 'live';
    if (isProduction && !isValidWebhookSignature(req.body, signature)) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(req.body.toString('utf8'));
    console.log('Monnify webhook received:', JSON.stringify(event));

    const reference = event?.eventData?.paymentReference;
    if (reference) {
      const verified = await verifyTransaction(reference);
      if (verified?.paymentStatus === 'PAID') {
        await confirmPaymentByReference(reference, verified);
      } else {
        await pool.query(
          `UPDATE orders SET status = 'payment_failed', updated_at = now()
           WHERE paystack_reference = $1 AND status = 'pending_payment'`,
          [reference]
        );
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook error:', err);
    res.sendStatus(200);
  }
});

module.exports = router;
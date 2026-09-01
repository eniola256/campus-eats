const express = require('express');
const pool = require('../db/pool');
const { calculateFees, MIN_ORDER_KOBO } = require('../services/fees');
const { initializeTransaction } = require('../services/monnify');
const { notify } = require('../services/whatsapp');

const router = express.Router();

function generateReference() {
  return `CE-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { customer, items } = req.body;
    if (!customer?.fullName || !customer?.phone || !customer?.hostel) {
      return res.status(400).json({ error: 'Missing customer details' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    await client.query('BEGIN');

    const custResult = await client.query(
      `INSERT INTO customers (full_name, phone, hostel, room_or_gate)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name,
         hostel = EXCLUDED.hostel, room_or_gate = EXCLUDED.room_or_gate
       RETURNING id`,
      [customer.fullName, customer.phone, customer.hostel, customer.roomOrGate || null]
    );
    const customerId = custResult.rows[0].id;

    const productIds = items.map((i) => i.productId);
    const { rows: products } = await client.query(
      `SELECT id, name, price_kobo, is_available FROM products WHERE id = ANY($1)`,
      [productIds]
    );
    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotalKobo = 0;
    const lineItems = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || !product.is_available) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Item no longer available: ${item.productId}` });
      }
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const lineTotal = product.price_kobo * quantity;
      subtotalKobo += lineTotal;
      lineItems.push({ product, quantity, lineTotal });
    }

    if (subtotalKobo < MIN_ORDER_KOBO) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Minimum order is ₦${MIN_ORDER_KOBO / 100}` });
    }

    const { serviceFeeKobo, deliveryFeeKobo } = await calculateFees(subtotalKobo);
    const totalKobo = subtotalKobo + serviceFeeKobo + deliveryFeeKobo;
    const reference = generateReference();

    const orderResult = await client.query(
      `INSERT INTO orders
        (customer_id, status, subtotal_kobo, service_fee_kobo, delivery_fee_kobo,
         total_kobo, delivery_hostel, delivery_note, paystack_reference)
       VALUES ($1, 'pending_payment', $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [customerId, subtotalKobo, serviceFeeKobo, deliveryFeeKobo, totalKobo,
       customer.hostel, customer.roomOrGate || null, reference]
    );
    const orderId = orderResult.rows[0].id;

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_kobo, quantity, line_total_kobo)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, li.product.id, li.product.name, li.product.price_kobo, li.quantity, li.lineTotal]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, note)
       VALUES ($1, NULL, 'pending_payment', 'Order created')`,
      [orderId]
    );

    await client.query('COMMIT');

    const email = customer.email || `${customer.phone}@campuseats.local`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/track/${orderId}/${encodeURIComponent(customer.phone)}`;

    const monnifyRes = await initializeTransaction({
      email,
      name: customer.fullName,
      amountKobo: totalKobo,
      reference,
      redirectUrl,
    });

    res.status(201).json({
      orderId,
      reference,
      totalKobo,
      checkoutUrl: monnifyRes?.checkoutUrl || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone query param required' });

    const { rows: orderRows } = await pool.query(
      `SELECT o.*, c.full_name, c.phone FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 AND c.phone = $2`,
      [req.params.id, phone]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const { rows: items } = await pool.query(
      `SELECT product_name, unit_price_kobo, quantity, status, line_total_kobo
       FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );

    const { rows: history } = await pool.query(
      `SELECT old_status, new_status, note, created_at FROM order_status_history
       WHERE order_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );

    res.json({ order: orderRows[0], items, history });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
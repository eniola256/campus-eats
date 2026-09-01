const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const { notify } = require('../services/whatsapp');
const { refundTransaction } = require('../services/monnify');

const router = express.Router();

const VALID_TRANSITIONS = {
  payment_confirmed: ['accepted', 'cancelled'],
  accepted: ['shopping', 'cancelled'],
  shopping: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered'],
};

// POST /api/admin/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, admin: { id: admin.id, name: admin.name, role: admin.role } });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders?status=payment_confirmed — dashboard order list
router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await pool.query(
      `SELECT o.*, c.full_name, c.phone, c.room_or_gate
       FROM orders o JOIN customers c ON c.id = o.customer_id
       WHERE ($1::text IS NULL OR o.status = $1)
       ORDER BY o.created_at DESC LIMIT 200`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders/:id — full order detail incl. items
router.get('/orders/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows: orderRows } = await pool.query(
      `SELECT o.*, c.full_name, c.phone, c.room_or_gate FROM orders o
       JOIN customers c ON c.id = o.customer_id WHERE o.id = $1`,
      [req.params.id]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'Not found' });
    const { rows: items } = await pool.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );
    res.json({ order: orderRows[0], items });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/status  { status: 'accepted' }
router.patch('/orders/:id/status', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { status: newStatus } = req.body;
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT o.status, c.phone, o.id, o.delivery_hostel FROM orders o
       JOIN customers c ON c.id = o.customer_id WHERE o.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const order = rows[0];
    const allowed = VALID_TRANSITIONS[order.status] || [];
    if (!allowed.includes(newStatus)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot move from ${order.status} to ${newStatus}` });
    }

    await client.query(`UPDATE orders SET status = $1, updated_at = now() WHERE id = $2`, [newStatus, order.id]);
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
      [order.id, order.status, newStatus, req.admin.id]
    );
    await client.query('COMMIT');

    if (newStatus === 'out_for_delivery') {
      await notify('out_for_delivery', order.phone, { orderId: order.id, hostel: order.delivery_hostel });
    } else if (newStatus === 'delivered') {
      await notify('order_delivered', order.phone, { orderId: order.id });
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// PATCH /api/admin/order-items/:id/unavailable — mark one item unavailable,
// record a refund, notify the customer, and shrink the order total.
router.patch('/order-items/:id/unavailable', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT oi.*, o.paystack_reference, o.id AS order_id, c.phone
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE oi.id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = rows[0];
    if (item.status !== 'ok') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Item already handled' });
    }

    await client.query(`UPDATE order_items SET status = 'unavailable' WHERE id = $1`, [item.id]);
    await client.query(
      `UPDATE orders SET total_kobo = total_kobo - $1, subtotal_kobo = subtotal_kobo - $1, updated_at = now()
       WHERE id = $2`,
      [item.line_total_kobo, item.order_id]
    );
    const refundResult = await client.query(
      `INSERT INTO refunds (order_id, order_item_id, amount_kobo, reason, status, processed_by)
       VALUES ($1, $2, $3, 'item_unavailable', 'pending', $4) RETURNING id`,
      [item.order_id, item.id, item.line_total_kobo, req.admin.id]
    );
    await client.query('COMMIT');

    // Attempt the actual Paystack refund; record outcome but don't block
    // the response on it — refunds can take a moment on Paystack's side.
    try {
      await refundTransaction({ reference: item.paystack_reference, amountKobo: item.line_total_kobo });
      await pool.query(`UPDATE refunds SET status = 'processed' WHERE id = $1`, [refundResult.rows[0].id]);
    } catch (refundErr) {
      console.error('Paystack refund failed, left as pending for manual follow-up:', refundErr);
    }

    await notify('item_unavailable', item.phone, {
      orderId: item.order_id,
      itemName: item.product_name,
      amount: (item.line_total_kobo / 100).toLocaleString(),
    });

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// --- Product & fee management ---

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY category, sort_order');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/products', requireAdmin, async (req, res, next) => {
  try {
    const { name, category, description, priceKobo, sortOrder } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO products (name, category, description, price_kobo, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, category, description || null, priceKobo, sortOrder || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, category, description, priceKobo, isAvailable, sortOrder } = req.body;
    const { rows } = await pool.query(
      `UPDATE products SET
         name = COALESCE($1, name),
         category = COALESCE($2, category),
         description = COALESCE($3, description),
         price_kobo = COALESCE($4, price_kobo),
         is_available = COALESCE($5, is_available),
         sort_order = COALESCE($6, sort_order),
         updated_at = now()
       WHERE id = $7 RETURNING *`,
      [name, category, description, priceKobo, isAvailable, sortOrder, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/fees/pause — pause/resume ordering by toggling every
// product's availability at once (simple V1 approach).
router.patch('/ordering/:action(pause|resume)', requireAdmin, async (req, res, next) => {
  try {
    const makeAvailable = req.params.action === 'resume';
    await pool.query('UPDATE products SET is_available = $1', [makeAvailable]);
    res.json({ ok: true, ordering: req.params.action });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

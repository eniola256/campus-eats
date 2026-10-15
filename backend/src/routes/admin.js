const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/auth');
const { notify } = require('../services/telegram');
const { getStoreStatus, setStoreStatus } = require('../services/storeStatus');

const router = express.Router();

// 'cancelled' is deliberately not here: cancelling must go through
// PATCH /orders/:id/cancel below, which also records the refund owed.
const VALID_TRANSITIONS = {
  payment_confirmed: ['accepted'],
  accepted: ['shopping'],
  shopping: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
};

// Statuses an order can still be cancelled from (it's paid, but not yet
// out for delivery).
const CANCELLABLE = ['payment_confirmed', 'accepted', 'shopping'];

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

router.get('/orders', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await pool.query(
      `SELECT o.*, c.full_name, c.phone, c.room_or_gate, s.name AS shop_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE ($1::text IS NULL OR o.status = $1)
       ORDER BY o.created_at DESC LIMIT 200`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows: orderRows } = await pool.query(
      `SELECT o.*, c.full_name, c.phone, c.room_or_gate, s.name AS shop_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN shops s ON s.id = o.shop_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (orderRows.length === 0) return res.status(404).json({ error: 'Not found' });
    const { rows: items } = await pool.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [req.params.id]
    );
    const { rows: refunds } = await pool.query(
      `SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ order: orderRows[0], items, refunds });
  } catch (err) {
    next(err);
  }
});

// Order history: every order, any status, optionally filtered by status and
// by date range. Dates are whole days in Lagos time, both ends included.
// The summary counts the whole filter; the list itself stops at 200 rows.
router.get('/history', requireAdmin, async (req, res, next) => {
  try {
    const { from, to, status } = req.query;
    const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if ((from && !isDate(from)) || (to && !isDate(to))) {
      return res.status(400).json({ error: 'Dates must look like 2026-10-16' });
    }

    const params = [status || null, from || null, to || null];
    const where = `WHERE ($1::text IS NULL OR o.status = $1)
        AND ($2::date IS NULL OR o.created_at >= (($2::date)::timestamp AT TIME ZONE 'Africa/Lagos'))
        AND ($3::date IS NULL OR o.created_at < ((($3::date + 1))::timestamp AT TIME ZONE 'Africa/Lagos'))`;

    const { rows: orders } = await pool.query(
      `SELECT o.id, o.status, o.total_kobo, o.created_at, o.delivery_hostel,
              c.full_name, c.phone, s.name AS shop_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       LEFT JOIN shops s ON s.id = o.shop_id
       ${where}
       ORDER BY o.created_at DESC LIMIT 200`,
      params
    );
    const { rows: summaryRows } = await pool.query(
      `SELECT count(*)::int AS total,
              (count(*) FILTER (WHERE o.status = 'delivered'))::int AS delivered,
              (count(*) FILTER (WHERE o.status = 'cancelled'))::int AS cancelled,
              COALESCE(sum(o.total_kobo) FILTER (WHERE o.status = 'delivered'), 0)::bigint AS delivered_kobo
       FROM orders o
       ${where}`,
      params
    );
    const s = summaryRows[0];
    res.json({
      orders,
      summary: {
        total: s.total,
        delivered: s.delivered,
        cancelled: s.cancelled,
        deliveredKobo: Number(s.delivered_kobo),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Open or close the store. Closing can carry a message customers will see.
router.patch('/store', requireAdmin, async (req, res, next) => {
  try {
    const { open, message } = req.body;
    if (typeof open !== 'boolean') {
      return res.status(400).json({ error: 'open must be true or false' });
    }
    await setStoreStatus(open, typeof message === 'string' ? message.trim().slice(0, 200) : undefined);
    res.json(await getStoreStatus());
  } catch (err) {
    next(err);
  }
});

router.get('/refunds', requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.query;
    const { rows } = await pool.query(
      `SELECT r.*, o.id AS order_number, c.full_name, c.phone
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE ($1::text IS NULL OR r.status = $1)
       ORDER BY r.created_at DESC LIMIT 200`,
      [status || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/orders/:id/status', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { status: newStatus } = req.body;
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT o.status, c.phone, c.telegram_chat_id, o.id, o.delivery_hostel FROM orders o
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
      await notify('out_for_delivery', order.telegram_chat_id, { orderId: order.id, hostel: order.delivery_hostel });
    } else if (newStatus === 'delivered') {
      await notify('order_delivered', order.telegram_chat_id, { orderId: order.id });
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// Cancel a paid order and record the refund owed for whatever is still
// unrefunded. total_kobo already excludes items refunded as unavailable
// (that route subtracts them), so refunding total_kobo can't double-refund.
router.patch('/orders/:id/cancel', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT o.id, o.status, o.total_kobo, c.telegram_chat_id
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1 FOR UPDATE OF o`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const order = rows[0];
    if (!CANCELLABLE.includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Cannot cancel an order that is ${order.status.replace(/_/g, ' ')}` });
    }

    await client.query(`UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`, [order.id]);
    await client.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, note)
       VALUES ($1, $2, 'cancelled', $3, 'Cancelled by admin')`,
      [order.id, order.status, req.admin.id]
    );
    if (order.total_kobo > 0) {
      await client.query(
        `INSERT INTO refunds (order_id, order_item_id, amount_kobo, reason, status, processed_by)
         VALUES ($1, NULL, $2, 'order_cancelled', 'pending', $3)`,
        [order.id, order.total_kobo, req.admin.id]
      );
    }
    await client.query('COMMIT');

    // Tell the customer (notify skips customers without Telegram and never throws).
    await notify('order_cancelled', order.telegram_chat_id, {
      orderId: order.id,
      amount: (order.total_kobo / 100).toLocaleString(),
    });

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/order-items/:id/contact', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT oi.*, o.id AS order_id, c.phone, c.telegram_chat_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE oi.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    const item = rows[0];
    if (item.status !== 'ok') return res.status(400).json({ error: 'Item already handled' });

    await pool.query(`UPDATE order_items SET contact_attempted_at = now() WHERE id = $1`, [item.id]);

    await notify('contacting_customer', item.telegram_chat_id, {
      orderId: item.order_id,
      itemName: item.product_name,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/order-items/:id/unavailable', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT oi.*, o.id AS order_id, c.phone, c.telegram_chat_id
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
    await client.query(
      `INSERT INTO refunds (order_id, order_item_id, amount_kobo, reason, status, processed_by)
       VALUES ($1, $2, $3, 'item_unavailable', 'pending', $4)`,
      [item.order_id, item.id, item.line_total_kobo, req.admin.id]
    );
    await client.query('COMMIT');

    await notify('item_unavailable', item.telegram_chat_id, {
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

router.patch('/refunds/:id/mark-refunded', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, o.id AS order_id, c.phone, c.telegram_chat_id
       FROM refunds r
       JOIN orders o ON o.id = r.order_id
       JOIN customers c ON c.id = o.customer_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Refund not found' });
    const refund = rows[0];
    if (refund.status === 'processed') return res.status(400).json({ error: 'Already marked refunded' });

    await pool.query(
      `UPDATE refunds SET status = 'processed', processed_by = $1, processed_at = now() WHERE id = $2`,
      [req.admin.id, refund.id]
    );

    await notify('refund_issued', refund.telegram_chat_id, {
      orderId: refund.order_id,
      amount: (refund.amount_kobo / 100).toLocaleString(),
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Product management (now shop-aware) ---

router.get('/products', requireAdmin, async (req, res, next) => {
  try {
    const { shopId } = req.query;
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE ($1::int IS NULL OR shop_id = $1) ORDER BY shop_id, category, sort_order`,
      [shopId || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const isBlank = (v) => !v || !String(v).trim();
const isValidPriceKobo = (v) => Number.isInteger(v) && v >= 0;

router.post('/products', requireAdmin, async (req, res, next) => {
  try {
    const { name, category, description, imageUrl, priceKobo, sortOrder, shopId } = req.body;
    if (!shopId) return res.status(400).json({ error: 'shopId is required' });
    if (isBlank(name)) return res.status(400).json({ error: 'Item name is required' });
    if (isBlank(category)) return res.status(400).json({ error: 'Category is required' });
    if (!isValidPriceKobo(priceKobo)) {
      return res.status(400).json({ error: 'Price must be a whole number of kobo, 0 or more' });
    }
    const { rows } = await pool.query(
      `INSERT INTO products (name, category, description, image_url, price_kobo, sort_order, shop_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name.trim(), category.trim(), description || null, imageUrl || null, priceKobo, sortOrder || 0, shopId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Only the fields present in the request body are updated, and '' clears a
// field (stored as NULL), same as the shop update. Column names come from
// this fixed list, never from the request.
const PRODUCT_FIELDS = {
  name: 'name',
  category: 'category',
  description: 'description',
  imageUrl: 'image_url',
  priceKobo: 'price_kobo',
  isAvailable: 'is_available',
  sortOrder: 'sort_order',
  shopId: 'shop_id',
};

router.patch('/products/:id', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body;
    if (body.name !== undefined && isBlank(body.name)) {
      return res.status(400).json({ error: 'Item name cannot be empty' });
    }
    if (body.category !== undefined && isBlank(body.category)) {
      return res.status(400).json({ error: 'Category cannot be empty' });
    }
    if (body.priceKobo !== undefined && !isValidPriceKobo(body.priceKobo)) {
      return res.status(400).json({ error: 'Price must be a whole number of kobo, 0 or more' });
    }

    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(PRODUCT_FIELDS)) {
      if (body[key] === undefined) continue;
      values.push(body[key] === '' ? null : body[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });
    sets.push('updated_at = now()');

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/ordering/:action(pause|resume)', requireAdmin, async (req, res, next) => {
  try {
    const makeAvailable = req.params.action === 'resume';
    await pool.query('UPDATE products SET is_available = $1', [makeAvailable]);
    res.json({ ok: true, ordering: req.params.action });
  } catch (err) {
    next(err);
  }
});

// --- Shop management — the whole point of this migration: adding or
// editing a restaurant is now a form submission, not a code deploy. ---

router.get('/shops', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shops ORDER BY sort_order, name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/shops', requireAdmin, async (req, res, next) => {
  try {
    const { name, description, imageUrl, rating, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: 'Shop name is required' });
    const { rows } = await pool.query(
      `INSERT INTO shops (name, description, image_url, rating, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, imageUrl || null, rating || null, sortOrder || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Only the fields present in the request body are updated, and '' clears a
// field (stored as NULL). The old COALESCE version could never clear one.
// Column names come from this fixed list, never from the request.
const SHOP_FIELDS = {
  name: 'name',
  description: 'description',
  imageUrl: 'image_url',
  rating: 'rating',
  isActive: 'is_active',
  sortOrder: 'sort_order',
};

router.patch('/shops/:id', requireAdmin, async (req, res, next) => {
  try {
    if (req.body.name !== undefined && !String(req.body.name).trim()) {
      return res.status(400).json({ error: 'Shop name cannot be empty' });
    }

    const sets = [];
    const values = [];
    for (const [key, column] of Object.entries(SHOP_FIELDS)) {
      if (req.body[key] === undefined) continue;
      values.push(req.body[key] === '' ? null : req.body[key]);
      sets.push(`${column} = $${values.length}`);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE shops SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
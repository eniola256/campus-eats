require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const adminRouter = require('./routes/admin');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Basic abuse protection on write-heavy public endpoints
const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

// The Paystack webhook needs the RAW body for signature verification, so it
// must be mounted BEFORE the global express.json() body parser.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/products', productsRouter);
app.use('/api/orders', orderLimiter, ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);

// Central error handler — keeps stack traces out of responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Campus Eats API running on port ${PORT}`));

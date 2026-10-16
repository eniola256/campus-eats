require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const productsRouter = require('./routes/products');
const shopsRouter = require('./routes/shops');
const ordersRouter = require('./routes/orders');
const paymentsRouter = require('./routes/payments');
const adminRouter = require('./routes/admin');
const telegramRouter = require('./routes/telegram');
const authRouter = require('./routes/auth');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

const orderLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

// --- Login protection -------------------------------------------------------
// Only the routes that can be abused are limited. Before, one limiter covered
// everything under /api/auth, so routine calls (the signup status polling,
// /me on every page load) used up the 10 tries and locked people out.
const FIFTEEN_MIN = 15 * 60 * 1000;
const tooMany = (message) => (req, res) => res.status(429).json({ error: message });

// Customer login, per IP. skipSuccessfulRequests: only wrong-password
// attempts (401) count, so correct logins never use up the allowance.
const loginIpLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many failed login attempts. Please try again in 15 minutes.'),
});

// Customer login, per phone number: stops someone rotating IPs to keep
// guessing one account's password. Failed attempts only, same as above.
const loginPhoneLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.body?.phone,
  keyGenerator: (req) => `phone:${String(req.body.phone).trim()}`,
  handler: tooMany('Too many failed login attempts for this account. Please try again in 15 minutes.'),
});

// Admin login: same idea, per IP, failed attempts only.
const adminLoginLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many failed login attempts. Please try again in 15 minutes.'),
});

// Signup and forgot-password each write a row and start a Telegram
// handshake, so every request counts here (not just failures).
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooMany('Too many requests. Please try again later.'),
});

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

// These run before the routers; they only call next(), so the real
// handlers in auth.js and admin.js still do the work.
app.post('/api/auth/login', loginIpLimiter, loginPhoneLimiter);
app.post('/api/admin/login', adminLoginLimiter);
app.post(['/api/auth/signup', '/api/auth/forgot-password'], signupLimiter);

app.use('/api/products', productsRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/orders', orderLimiter, ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/telegram', telegramRouter);
app.use('/api/auth', authRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Campus Eats API running on port ${PORT}`));
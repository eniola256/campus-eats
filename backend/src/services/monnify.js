const https = require('https');
const crypto = require('crypto');

const MONNIFY_BASE_HOST =
  process.env.MONNIFY_ENV === 'live' ? 'api.monnify.com' : 'sandbox.monnify.com';
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY;
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY;
const MONNIFY_CONTRACT_CODE = process.env.MONNIFY_CONTRACT_CODE;

function monnifyRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers.Authorization = `Bearer ${token}`;

    const req = https.request(
      { hostname: MONNIFY_BASE_HOST, path, method, headers },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 400) return reject(parsed);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Monnify uses a Bearer token, not a static secret key like Paystack —
// obtained by Base64-encoding apiKey:secretKey and posting to /auth/login.
// Tokens expire after ~1 hour, so we cache it and only fetch a new one
// once it's actually expired (with a small safety buffer).
let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`).toString('base64');

  const response = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: MONNIFY_BASE_HOST,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { Authorization: `Basic ${credentials}` },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });

  if (!response.requestSuccessful) {
    throw new Error(`Monnify auth failed: ${response.responseMessage || 'unknown error'}`);
  }

  cachedToken = response.responseBody.accessToken;
  // expiresIn is in seconds — refresh a minute early to avoid edge-case
  // failures right as a token expires mid-request.
  tokenExpiresAt = Date.now() + (response.responseBody.expiresIn - 60) * 1000;

  return cachedToken;
}

// Same call shape as paystack.js's initializeTransaction, so payments.js
// (or wherever this gets called) barely needs to change. amountKobo comes
// in as kobo (matching our schema), converted to naira here since that's
// what Monnify's API expects.
async function initializeTransaction({ email, name, amountKobo, reference, redirectUrl }) {
  const token = await getAccessToken();
  const amountNaira = amountKobo / 100;

  const response = await monnifyRequest(
    'POST',
    '/api/v1/merchant/transactions/init-transaction',
    {
      amount: amountNaira,
      customerName: name,
      customerEmail: email,
      paymentReference: reference,
      paymentDescription: `Campus Eats order ${reference}`,
      currencyCode: 'NGN',
      contractCode: MONNIFY_CONTRACT_CODE,
      redirectUrl,
    },
    token
  );

  if (!response.requestSuccessful) {
    throw new Error(`Monnify initialize failed: ${response.responseMessage}`);
  }

  return response.responseBody; // includes checkoutUrl, transactionReference
}

// Verify by OUR paymentReference (the one we generated) — always re-check
// server-side, same principle as Paystack: never trust the redirect alone.
//
// NOTE: exact endpoint path below is my best-confirmed understanding from
// Monnify's docs, but their code samples didn't fully render for me to
// copy verbatim — please confirm this against the sample code shown in
// YOUR Monnify dashboard once you have real sandbox credentials, before
// relying on it. Everything else here (auth flow, response fields,
// webhook signature) I was able to confirm directly.
async function verifyTransaction(paymentReference) {
  const token = await getAccessToken();
  const response = await monnifyRequest(
    'GET',
    `/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`,
    null,
    token
  );

  if (!response.requestSuccessful) {
    throw new Error(`Monnify verify failed: ${response.responseMessage}`);
  }

  return response.responseBody; // includes paymentStatus, amountPaid (in naira)
}

// Verifies a webhook genuinely came from Monnify. Per Monnify's docs, this
// signature header is ONLY sent in production, not sandbox — meaning we
// can't fully test this specific check until going live. Worth building
// it correctly now regardless, and testing the rest of the webhook flow
// via the verify-on-redirect path in the meantime.
function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const hash = crypto
    .createHmac('sha512', MONNIFY_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === signatureHeader;
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature };

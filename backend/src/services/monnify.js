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
  tokenExpiresAt = Date.now() + (response.responseBody.expiresIn - 60) * 1000;
  return cachedToken;
}

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
  return response.responseBody;
}

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
  return response.responseBody;
}

function isValidWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const hash = crypto.createHmac('sha512', MONNIFY_SECRET_KEY).update(rawBody).digest('hex');
  return hash === signatureHeader;
}

// NOTE: endpoint path is my best-confirmed understanding of Monnify's
// refund API, following the same shape as their other transaction
// endpoints — but I could not verify this against live docs. Test this
// against one real sandbox transaction and check the response shape
// before trusting it in the admin "mark unavailable" flow.
async function refundTransaction({ reference, amountKobo, customerNote }) {
  const token = await getAccessToken();
  const amountNaira = amountKobo / 100;
  const response = await monnifyRequest(
    'POST',
    '/api/v1/refunds/initiate-refund',
    {
      transactionReference: reference,
      refundReason: customerNote || 'Item unavailable',
      refundAmount: amountNaira,
      customerNote: customerNote || 'Item unavailable',
    },
    token
  );
  if (!response.requestSuccessful) {
    throw new Error(`Monnify refund failed: ${response.responseMessage}`);
  }
  return response.responseBody;
}

module.exports = { initializeTransaction, verifyTransaction, isValidWebhookSignature, refundTransaction };
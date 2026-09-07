const https = require('https');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const TEMPLATES = {
  order_confirmed: (o) => `Hi ${o.name}, your Campus Eats order #${o.orderId} has been received. We'll ping you again once it's confirmed.`,
  payment_confirmed: (o) => `Payment received for order #${o.orderId} (₦${o.total}). We're getting it ready!`,
  contacting_customer: (o) => `Hi, we're trying to reach you about order #${o.orderId} — "${o.itemName}" isn't available at the shop right now. Reply here or expect a call shortly to sort out a substitute or refund.`,
  item_unavailable: (o) => `Heads up: "${o.itemName}" wasn't available at the shop for order #${o.orderId}. You'll be refunded ₦${o.amount} for that item shortly. The rest of your order is still on the way.`,
  refund_issued: (o) => `A refund of ₦${o.amount} has been sent for order #${o.orderId}.`,
  out_for_delivery: (o) => `Your order #${o.orderId} is on its way to ${o.hostel}!`,
  order_arrived: (o) => `We're outside! Please come out to collect order #${o.orderId} at ${o.hostel}.`,
  order_delivered: (o) => `Order #${o.orderId} delivered. Enjoy your food! Reply if anything was off.`,
  telegram_connected: () => `You're connected! Order updates for Campus Eats will show up right here from now on.`,
};

function sendTelegramMessage(chatId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ chat_id: chatId, text });
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            resolve({ raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function notify(template, chatId, data) {
  const build = TEMPLATES[template];
  if (!build) {
    console.error(`Unknown Telegram template: ${template}`);
    return { skipped: true };
  }
  const body = build(data);

  if (!chatId) {
    console.log(`[telegram:not-connected] template=${template} body="${body}"`);
    return { skipped: true, reason: 'not_connected' };
  }
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[telegram:dry-run] to=${chatId} template=${template} body="${body}"`);
    return { dryRun: true, body };
  }

  try {
    return await sendTelegramMessage(chatId, body);
  } catch (err) {
    console.error(`Telegram send failed for chat ${chatId}:`, err.message || err);
    return { error: true };
  }
}

module.exports = { notify, sendTelegramMessage, TEMPLATES };
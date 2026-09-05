const https = require('https');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

const TEMPLATES = {
  order_confirmed: (o) => `Hi ${o.name}, your Campus Eats order #${o.orderId} has been received. We'll ping you again once it's confirmed.`,
  payment_confirmed: (o) => `Payment received for order #${o.orderId} (₦${o.total}). We're getting it ready!`,
  contacting_customer: (o) => `Hi, we're trying to reach you about order #${o.orderId} — "${o.itemName}" isn't available at the shop right now. Reply here or expect a call shortly to sort out a substitute or refund.`,
  item_unavailable: (o) => `Heads up: "${o.itemName}" wasn't available at the shop for order #${o.orderId}. You'll be refunded ₦${o.amount} for that item shortly. The rest of your order is still on the way.`,
  refund_issued: (o) => `A refund of ₦${o.amount} has been sent for order #${o.orderId}.`,
  out_for_delivery: (o) => `Your order #${o.orderId} is on its way to ${o.hostel}!`,
  order_arrived: (o) => `We're outside! Please come out to collect order #${o.orderId} at ${o.hostel}.`,
  order_delivered: (o) => `Order #${o.orderId} delivered. Enjoy your food! Reply if anything was off.`,
};

function sendWhatsAppText(toPhone, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: toPhone,
      type: 'text',
      text: { body },
    });
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: `/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
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

async function notify(template, toPhone, data) {
  const build = TEMPLATES[template];
  if (!build) throw new Error(`Unknown WhatsApp template: ${template}`);
  const body = build(data);
  if (!WHATSAPP_TOKEN) {
    console.log(`[whatsapp:dry-run] to=${toPhone} template=${template} body="${body}"`);
    return { dryRun: true, body };
  }
  return sendWhatsAppText(toPhone, body);
}

module.exports = { notify, TEMPLATES };
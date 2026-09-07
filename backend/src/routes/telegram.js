const express = require('express');
const pool = require('../db/pool');
const { sendTelegramMessage, TEMPLATES } = require('../services/telegram');

const router = express.Router();

router.post('/webhook', async (req, res) => {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && req.headers['x-telegram-bot-api-secret-token'] !== expectedSecret) {
      return res.sendStatus(401);
    }

    const update = req.body;
    const message = update?.message;
    const text = message?.text || '';
    const chatId = message?.chat?.id;

    if (text.startsWith('/start') && chatId) {
      const payload = text.split(' ')[1];
      if (payload) {
        const { rowCount } = await pool.query(
          `UPDATE customers SET telegram_chat_id = $1 WHERE phone = $2`,
          [chatId, payload]
        );
        if (rowCount > 0) {
          await sendTelegramMessage(chatId, TEMPLATES.telegram_connected());
        } else {
          await sendTelegramMessage(chatId, "We couldn't match this to an order yet — try tapping the link from your order tracking page again.");
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.sendStatus(200);
  }
});

module.exports = router;
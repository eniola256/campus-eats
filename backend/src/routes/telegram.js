const express = require('express');
const crypto = require('crypto');
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
      const payload = text.split(' ')[1] || '';

      if (payload.startsWith('connect_')) {
        const phone = payload.slice('connect_'.length);
        const { rowCount } = await pool.query(
          `UPDATE customers SET telegram_chat_id = $1 WHERE phone = $2`,
          [chatId, phone]
        );
        await sendTelegramMessage(
          chatId,
          rowCount > 0
            ? TEMPLATES.telegram_connected()
            : "We couldn't match this to an order yet — try tapping the link from your order tracking page again."
        );
      } else if (payload.startsWith('login_')) {
        const loginToken = payload.slice('login_'.length);

        const { rows } = await pool.query(
          `SELECT * FROM login_attempts WHERE login_token = $1`,
          [loginToken]
        );
        const attempt = rows[0];

        if (!attempt) {
          await sendTelegramMessage(chatId, "This login link isn't valid — go back to the site and try logging in again.");
        } else if (attempt.confirmed_at) {
          await sendTelegramMessage(chatId, "This login link was already used. Go back to the site and start a fresh login if you need one.");
        } else if (new Date(attempt.expires_at) < new Date()) {
          await sendTelegramMessage(chatId, "This login link expired — go back to the site and try again.");
        } else {
          const sessionToken = crypto.randomBytes(32).toString('hex');
          await pool.query(
            `UPDATE login_attempts SET confirmed_at = now(), session_token = $1 WHERE id = $2`,
            [sessionToken, attempt.id]
          );
          await pool.query(
            `UPDATE customers SET telegram_chat_id = $1 WHERE phone = $2`,
            [chatId, attempt.phone]
          );
          await sendTelegramMessage(chatId, "You're logged in! Head back to the site — it should update automatically within a few seconds.");
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
/**
 * telegramAlert.ts
 * Sends Telegram messages via Bot API for critical system alerts.
 * Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file.
 *
 * Setup instructions:
 *  1. Create a bot via @BotFather on Telegram → get the Bot Token
 *  2. Add the bot to your group or start a DM with it
 *  3. Get your Chat ID via: https://api.telegram.org/bot<TOKEN>/getUpdates
 *  4. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
 */

export async function sendTelegramAlert(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[TelegramAlert] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured. Skipping alert.');
    console.warn(`[TelegramAlert] Alert message was: ${message}`);
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json() as any;
    if (!data.ok) {
      console.error('[TelegramAlert] Failed to send Telegram message:', data.description);
    } else {
      console.log('[TelegramAlert] ✅ Alert sent successfully.');
    }
  } catch (err) {
    console.error('[TelegramAlert] Error sending Telegram alert:', err);
  }
}

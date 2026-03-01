import { debug, warn, error } from '../logger.mjs';

export class TelegramBackend {
  async send(notification) {
    const { config } = notification;
    if (!config || !config.botToken || !config.chatId) {
      warn('Telegram: no botToken or chatId configured, skipping');
      return;
    }

    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const title = notification.subtitle
      ? `*${notification.title}* · ${notification.subtitle}`
      : `*${notification.title}*`;
    const lines = [title, notification.body].filter(Boolean);

    const payload = {
      chat_id: config.chatId,
      text: lines.join('\n'),
      parse_mode: 'Markdown',
    };

    const fetchFn = notification.fetchFn || fetch;
    debug(`Telegram: POST ${url.replace(config.botToken, '<redacted>')}`);
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      error(`Telegram: HTTP ${response.status} ${response.statusText}`);
    } else {
      debug(`Telegram: HTTP ${response.status} OK`);
    }
  }
}

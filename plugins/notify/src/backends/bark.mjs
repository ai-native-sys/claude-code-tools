import { debug, warn, error } from '../logger.mjs';

export class BarkBackend {
  async send(notification) {
    const { config } = notification;
    if (!config || !config.deviceKey) {
      warn('Bark: no deviceKey configured, skipping');
      return;
    }

    const serverUrl = (config.serverUrl || 'https://api.day.app').replace(/\/+$/, '');
    const url = `${serverUrl}/push`;
    const barkLevel = notification.level === 'action' ? 'timeSensitive' : 'active';
    const payload = {
      device_key: config.deviceKey,
      title: notification.title,
      subtitle: notification.subtitle,
      body: notification.body,
      group: notification.group,
      level: barkLevel,
    };

    if (config.sound) payload.sound = config.sound;
    if (config.icon) payload.icon = config.icon;

    const fetchFn = notification.fetchFn || fetch;
    debug(`Bark: POST ${url}`);
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      error(`Bark: HTTP ${response.status} ${response.statusText}`);
    } else {
      debug(`Bark: HTTP ${response.status} OK`);
    }
  }
}

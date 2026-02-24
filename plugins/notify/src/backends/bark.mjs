import { warn, error } from '../logger.mjs';

export class BarkBackend {
  async send(notification) {
    const { config } = notification;
    if (!config || !config.deviceKey) {
      warn('Bark: no deviceKey configured, skipping');
      return;
    }

    const serverUrl = (config.serverUrl || 'https://api.day.app').replace(/\/+$/, '');
    const payload = {
      device_key: config.deviceKey,
      title: notification.title,
      body: notification.body,
      group: notification.group,
      level: notification.level,
    };

    if (config.sound) payload.sound = config.sound;
    if (config.icon) payload.icon = config.icon;

    const response = await fetch(`${serverUrl}/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      error(`Bark: HTTP ${response.status} ${response.statusText}`);
    }
  }
}

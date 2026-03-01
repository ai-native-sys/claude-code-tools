import { debug, warn, error } from '../logger.mjs';

const BASE_URL = 'https://open.feishu.cn/open-apis';
const TOKEN_URL = `${BASE_URL}/auth/v3/tenant_access_token/internal`;
const MSG_URL = `${BASE_URL}/im/v1/messages`;

// Cache token across invocations within the same process (valid for 2h)
let tokenCache = { token: '', expiresAt: 0 };

async function getTenantAccessToken(appId, appSecret, fetchFn) {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    debug('Feishu: using cached tenant_access_token');
    return tokenCache.token;
  }

  debug('Feishu: fetching tenant_access_token');
  const res = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`token request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`token request failed: ${data.msg} (code ${data.code})`);
  }

  // Cache with 5-minute safety margin
  tokenCache = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + (data.expire - 300) * 1000,
  };
  debug(`Feishu: got tenant_access_token, expires in ${data.expire}s`);
  return data.tenant_access_token;
}

export class FeishuBackend {
  async send(notification) {
    const { config } = notification;
    if (!config || !config.appId || !config.appSecret || !config.chatId) {
      warn('Feishu: missing appId, appSecret, or chatId, skipping');
      return;
    }

    const fetchFn = notification.fetchFn || fetch;
    const token = await getTenantAccessToken(config.appId, config.appSecret, fetchFn);

    const headerTitle = notification.subtitle
      ? `${notification.title} · ${notification.subtitle}`
      : notification.title;

    const card = {
      header: {
        title: { content: headerTitle, tag: 'plain_text' },
        template: { success: 'green', action: 'blue', warning: 'orange' }[notification.level] || 'blue',
      },
      elements: [
        ...(notification.body ? [{ tag: 'div', text: { content: notification.body, tag: 'plain_text' } }] : []),
      ],
    };

    const url = `${MSG_URL}?receive_id_type=chat_id`;
    debug(`Feishu: POST ${MSG_URL} -> chat_id=${config.chatId}`);
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: config.chatId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      error(`Feishu: HTTP ${res.status} ${res.statusText}`);
    } else {
      const data = await res.json();
      if (data.code !== 0) {
        error(`Feishu: API error: ${data.msg} (code ${data.code})`);
      } else {
        debug(`Feishu: message sent OK`);
      }
    }
  }
}

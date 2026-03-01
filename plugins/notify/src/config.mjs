import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

import { debug, error } from './logger.mjs';

const CONFIG_DIR = join(homedir(), '.claude', 'plugins', 'claude-code-tools', 'notify');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  backend: 'bark',
  logLevel: 'info',
  bark: {
    serverUrl: 'https://api.day.app',
    deviceKey: '',
    sound: 'minuet.caf',
    icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=128',
  },
  tg: {
    botToken: '',
    chatId: '',
  },
  feishu: {
    appId: '',
    appSecret: '',
    chatId: '',
  },
};

export function loadConfig() {
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    debug(`config: loaded from ${CONFIG_FILE}`);
  } catch {
    error('No config file or invalid JSON — using defaults');
  }

  // Normalize backend(s) to always be an array
  const rawBackend = fileConfig.backend || DEFAULTS.backend;
  const backends = Array.isArray(rawBackend) ? rawBackend : [rawBackend];

  const config = {
    backends,
    logLevel: fileConfig.logLevel || DEFAULTS.logLevel,
    bark: {
      ...DEFAULTS.bark,
      ...fileConfig.bark,
    },
    tg: {
      ...DEFAULTS.tg,
      ...fileConfig.tg,
    },
    feishu: {
      ...DEFAULTS.feishu,
      ...fileConfig.feishu,
    },
  };

  // Env var overrides (highest priority)
  const envOverrides = [];
  if (process.env.NOTIFY_BACKEND) {
    config.backends = process.env.NOTIFY_BACKEND.split(',').map(s => s.trim());
    envOverrides.push('NOTIFY_BACKEND');
  }
  if (process.env.BARK_SERVER_URL) {
    config.bark.serverUrl = process.env.BARK_SERVER_URL;
    envOverrides.push('BARK_SERVER_URL');
  }
  if (process.env.BARK_DEVICE_KEY) {
    config.bark.deviceKey = process.env.BARK_DEVICE_KEY;
    envOverrides.push('BARK_DEVICE_KEY');
  }
  if (process.env.TG_BOT_TOKEN) {
    config.tg.botToken = process.env.TG_BOT_TOKEN;
    envOverrides.push('TG_BOT_TOKEN');
  }
  if (process.env.TG_CHAT_ID) {
    config.tg.chatId = process.env.TG_CHAT_ID;
    envOverrides.push('TG_CHAT_ID');
  }
  if (process.env.FEISHU_APP_ID) {
    config.feishu.appId = process.env.FEISHU_APP_ID;
    envOverrides.push('FEISHU_APP_ID');
  }
  if (process.env.FEISHU_APP_SECRET) {
    config.feishu.appSecret = process.env.FEISHU_APP_SECRET;
    envOverrides.push('FEISHU_APP_SECRET');
  }
  if (process.env.FEISHU_CHAT_ID) {
    config.feishu.chatId = process.env.FEISHU_CHAT_ID;
    envOverrides.push('FEISHU_CHAT_ID');
  }
  if (process.env.NOTIFY_LOG_LEVEL) {
    config.logLevel = process.env.NOTIFY_LOG_LEVEL;
    envOverrides.push('NOTIFY_LOG_LEVEL');
  }

  debug(`config: backends=${config.backends.join(',')}, logLevel=${config.logLevel}${envOverrides.length ? `, envOverrides=[${envOverrides.join(',')}]` : ''}`);
  return config;
}

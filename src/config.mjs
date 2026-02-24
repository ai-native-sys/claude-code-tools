import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');
const CONFIG_FILE = join(PLUGIN_ROOT, 'config.json');

const DEFAULTS = {
  backend: 'bark',
  logLevel: 'info',
  bark: {
    serverUrl: 'https://api.day.app',
    deviceKey: '',
    sound: 'minuet.caf',
    icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=128',
  },
};

export function loadConfig() {
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    // No config file or invalid JSON — use defaults
  }

  const config = {
    backend: fileConfig.backend || DEFAULTS.backend,
    logLevel: fileConfig.logLevel || DEFAULTS.logLevel,
    bark: {
      ...DEFAULTS.bark,
      ...fileConfig.bark,
    },
  };

  // Env var overrides (highest priority)
  if (process.env.NOTIFY_BACKEND) {
    config.backend = process.env.NOTIFY_BACKEND;
  }
  if (process.env.BARK_SERVER_URL) {
    config.bark.serverUrl = process.env.BARK_SERVER_URL;
  }
  if (process.env.BARK_DEVICE_KEY) {
    config.bark.deviceKey = process.env.BARK_DEVICE_KEY;
  }
  if (process.env.NOTIFY_LOG_LEVEL) {
    config.logLevel = process.env.NOTIFY_LOG_LEVEL;
  }

  return config;
}

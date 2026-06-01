import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { debug } from './logger.mjs';

const CONFIG_DIR = join(homedir(), '.claude', 'plugins', 'claude-code-tools', 'hud');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  logLevel: 'info',
  segments: ['model', 'billing', 'workspace', 'git', 'time', 'context', 'quota', 'cost', 'agents'],
  separator: ' \u2502 ',
  thresholds: { warn: 70, crit: 85 },
  bar: { filled: '■', empty: '□', width: 10 },
  cost: { show: 'auto' },  // 'auto' (hide on subscription), 'always', 'never'
git: { cacheTtlMs: 5000, timeoutMs: 1000 },
  billing: { cacheTtlMs: 3600000 },
  quota: { cacheTtlMs: 600000 },  // 10 min
  agents: { show: true },
};

export function loadConfig() {
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    debug(`config: loaded from ${CONFIG_FILE}`);
  } catch {
    debug('config: no config file or invalid JSON — using defaults');
  }

  const config = {
    logLevel: fileConfig.logLevel || DEFAULTS.logLevel,
    segments: fileConfig.segments || DEFAULTS.segments,
    separator: fileConfig.separator ?? DEFAULTS.separator,
    thresholds: { ...DEFAULTS.thresholds, ...fileConfig.thresholds },
    bar: { ...DEFAULTS.bar, ...fileConfig.bar },
    cost: { ...DEFAULTS.cost, ...fileConfig.cost },
git: { ...DEFAULTS.git, ...fileConfig.git },
    billing: { ...DEFAULTS.billing, ...fileConfig.billing },
    quota: { ...DEFAULTS.quota, ...fileConfig.quota },
    agents: { ...DEFAULTS.agents, ...fileConfig.agents },
  };

  // Env var overrides (highest priority)
  const envOverrides = [];
  if (process.env.HUD_SEGMENTS) {
    config.segments = process.env.HUD_SEGMENTS.split(',').map(s => s.trim());
    envOverrides.push('HUD_SEGMENTS');
  }
  if (process.env.HUD_LOG_LEVEL) {
    config.logLevel = process.env.HUD_LOG_LEVEL;
    envOverrides.push('HUD_LOG_LEVEL');
  }
  if (process.env.HUD_COST_SHOW) {
    config.cost.show = process.env.HUD_COST_SHOW;
    envOverrides.push('HUD_COST_SHOW');
  }
  if (process.env.HUD_QUOTA_CACHE_TTL) {
    config.quota.cacheTtlMs = parseInt(process.env.HUD_QUOTA_CACHE_TTL, 10);
    envOverrides.push('HUD_QUOTA_CACHE_TTL');
  }

  debug(`config: segments=${config.segments.join(',')}, logLevel=${config.logLevel}${envOverrides.length ? `, envOverrides=[${envOverrides.join(',')}]` : ''}`);
  return config;
}

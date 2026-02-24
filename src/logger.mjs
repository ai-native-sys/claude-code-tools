import { appendFileSync, statSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

const LOG_DIR = join(PLUGIN_ROOT, 'logs');
const LOG_FILE = join(LOG_DIR, 'notify.log');
const ROTATED_LOG_FILE = join(LOG_DIR, 'notify.log.1');
const MAX_LOG_SIZE = 512 * 1024; // 512 KB

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let currentLevel = 'debug';

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // If we can't create the log dir, logging will silently fail
}

function rotateIfNeeded() {
  try {
    const stat = statSync(LOG_FILE);
    if (stat.size >= MAX_LOG_SIZE) {
      renameSync(LOG_FILE, ROTATED_LOG_FILE);
    }
  } catch {
    // File doesn't exist yet or stat failed
  }
}

function writeLog(level, message) {
  if (LEVELS[level] === undefined || LEVELS[level] < LEVELS[currentLevel]) {
    return;
  }

  const timestamp = new Date().toISOString();
  const line = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}\n`;

  try {
    rotateIfNeeded();
    appendFileSync(LOG_FILE, line);
  } catch {
    // Logging must never throw
  }
}

export function configure({ logLevel } = {}) {
  if (logLevel && LEVELS[logLevel] !== undefined) {
    currentLevel = logLevel;
  }
}

export function debug(message) {
  writeLog('debug', message);
}

export function info(message) {
  writeLog('info', message);
}

export function warn(message) {
  writeLog('warn', message);
}

export function error(message) {
  writeLog('error', message);
}

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

const CACHE_DIR = join(homedir(), '.claude', 'plugins', 'claude-code-tools', 'hud', 'cache');

try {
  mkdirSync(CACHE_DIR, { recursive: true });
} catch {
  // Ignore — cache ops will silently fail
}

/**
 * Read a cached JSON file. Returns { data, expired } or null if missing/corrupt.
 * @param {string} filePath — absolute path to cache file
 * @param {number} ttlMs — max age in milliseconds
 */
export function readCache(filePath, ttlMs) {
  try {
    const stat = statSync(filePath);
    const age = Date.now() - stat.mtimeMs;
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return { data, expired: age >= ttlMs };
  } catch {
    return null;
  }
}

/**
 * Write data to a cache file atomically (best-effort).
 * @param {string} filePath — absolute path
 * @param {*} data — JSON-serializable
 */
export function writeCache(filePath, data) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data), 'utf-8');
  } catch {
    // Cache write failures are non-fatal
  }
}

/** Get the standard cache directory path */
export function getCacheDir() {
  return CACHE_DIR;
}

import { join } from 'node:path';
import { readCache, writeCache, getCacheDir } from './cache.mjs';
import { debug } from './logger.mjs';

const CACHE_FILE = join(getCacheDir(), 'speed.json');

/**
 * Speed segment — tokens/sec via file-based delta caching.
 *
 * Called every ~300ms by the statusline. We keep a baseline (token count +
 * timestamp) and only recompute speed once at least `windowMs` has elapsed.
 * Between recomputations we display the last known speed.
 */
export function speedSegment(stdin, config) {
  const outputTokens = stdin?.context_window?.current_usage?.output_tokens;
  if (outputTokens == null) return null;

  const now = Date.now();
  const windowMs = config?.speed?.windowMs ?? 2000;
  const cached = readCache(CACHE_FILE, Infinity); // never expire — we manage staleness ourselves

  if (!cached || !cached.data) {
    // First run — seed baseline
    writeCache(CACHE_FILE, { baseTokens: outputTokens, baseTime: now, tokPerSec: null });
    return null;
  }

  const prev = cached.data;
  const deltaTime = now - prev.baseTime;
  const deltaTokens = outputTokens - prev.baseTokens;

  let tokPerSec = prev.tokPerSec;

  if (deltaTime >= windowMs) {
    if (deltaTokens > 0) {
      tokPerSec = Math.round(deltaTokens / (deltaTime / 1000));
    } else {
      // No new tokens in this window — model is idle
      tokPerSec = null;
    }
    debug(`speed: deltaTokens=${deltaTokens} deltaTime=${deltaTime}ms -> ${tokPerSec} tok/s (outputTokens=${outputTokens})`);
    // Reset baseline for next window
    writeCache(CACHE_FILE, { baseTokens: outputTokens, baseTime: now, tokPerSec });
  }

  if (tokPerSec == null || tokPerSec <= 0) return null;

  return { text: `${tokPerSec} tok/s`, priority: 5, line: 2 };
}

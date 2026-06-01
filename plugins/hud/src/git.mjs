import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readCache, writeCache, getCacheDir } from './cache.mjs';
import { green, red, dim } from './render.mjs';

const CACHE_FILE = join(getCacheDir(), 'git.json');

/**
 * Git segment — branch name + diff stats.
 */
export function gitSegment(stdin, config) {
  const cwd = stdin?.cwd;
  if (!cwd) return null;

  const ttl = config?.git?.cacheTtlMs ?? 5000;
  const timeout = config?.git?.timeoutMs ?? 1000;

  // Check cache
  const cached = readCache(CACHE_FILE, ttl);
  if (cached && !cached.expired && cached.data.cwd === cwd) {
    return cached.data.segment;
  }

  let branch = '';
  let diffStats = '';

  try {
    branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Not a git repo — return empty
    writeCache(CACHE_FILE, { cwd, segment: null });
    return null;
  }

  try {
    const raw = execFileSync('git', ['diff', '--shortstat'], {
      cwd,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (raw) {
      const insMatch = raw.match(/(\d+) insertion/);
      const delMatch = raw.match(/(\d+) deletion/);
      const ins = insMatch ? insMatch[1] : null;
      const del = delMatch ? delMatch[1] : null;
      const parts = [];
      if (ins) parts.push(green(`+${ins}`));
      if (del) parts.push(red(`-${del}`));
      if (parts.length) diffStats = ` ${parts.join('/')}`;
    }
  } catch {
    // diff failed — just show branch
  }

  const text = `${dim('git:(')}${branch}${dim(')')}${diffStats}`;
  const segment = { text, priority: 4, line: 1 };

  writeCache(CACHE_FILE, { cwd, segment });
  return segment;
}

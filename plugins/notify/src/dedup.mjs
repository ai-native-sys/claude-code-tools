import { writeFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { debug } from './logger.mjs';

const DEDUP_WINDOW_MS = 2000;

// When a PreToolUse (e.g. AskUserQuestion) fires, the subsequent
// PermissionRequest for the same tool is redundant — suppress it.
const SUPPRESSED_BY = {
  PermissionRequest: ['PreToolUse'],
};

export function isDuplicate(sessionId, hookEvent, toolName) {
  if (!sessionId || !hookEvent) return false;

  // Include tool name in the key so dedup is per-tool
  const key = toolName ? `${hookEvent}-${toolName}` : hookEvent;

  // Check if a recent notification from a higher-priority event suppresses this one
  // e.g. PreToolUse-AskUserQuestion suppresses PermissionRequest-AskUserQuestion
  const suppressors = SUPPRESSED_BY[hookEvent];
  if (suppressors && toolName) {
    for (const src of suppressors) {
      const srcLock = join(tmpdir(), `claude-notify-${sessionId}-${src}-${toolName}.lock`);
      try {
        const stat = statSync(srcLock);
        const age = Date.now() - stat.mtimeMs;
        if (age < DEDUP_WINDOW_MS) {
          debug(`dedup: ${key} suppressed by recent ${src}-${toolName} (age=${age}ms)`);
          return true;
        }
      } catch { /* lock doesn't exist */ }
    }
  }

  const lockFile = join(tmpdir(), `claude-notify-${sessionId}-${key}.lock`);

  // Check if lock exists and is recent
  try {
    const stat = statSync(lockFile);
    const age = Date.now() - stat.mtimeMs;
    if (age < DEDUP_WINDOW_MS) {
      debug(`dedup: lock hit, age=${age}ms (<${DEDUP_WINDOW_MS}ms window)`);
      return true;
    }
    // Stale lock — remove it
    debug(`dedup: stale lock, age=${age}ms, removing`);
    try { unlinkSync(lockFile); } catch { /* ignore */ }
  } catch {
    // Lock doesn't exist — not a duplicate
  }

  // Create lock file atomically
  try {
    writeFileSync(lockFile, String(Date.now()), { flag: 'wx' });
    debug(`dedup: lock created at ${lockFile}`);
  } catch {
    // If wx fails (file appeared between check and create), treat as duplicate
    debug('dedup: lock race condition, treating as duplicate');
    return true;
  }

  return false;
}

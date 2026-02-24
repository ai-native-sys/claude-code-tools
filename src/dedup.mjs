import { writeFileSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DEDUP_WINDOW_MS = 2000;

export function isDuplicate(sessionId, hookEvent) {
  if (!sessionId || !hookEvent) return false;

  const lockFile = join(tmpdir(), `claude-notify-${sessionId}-${hookEvent}.lock`);

  // Check if lock exists and is recent
  try {
    const stat = statSync(lockFile);
    const age = Date.now() - stat.mtimeMs;
    if (age < DEDUP_WINDOW_MS) {
      return true;
    }
    // Stale lock — remove it
    try { unlinkSync(lockFile); } catch { /* ignore */ }
  } catch {
    // Lock doesn't exist — not a duplicate
  }

  // Create lock file atomically
  try {
    writeFileSync(lockFile, String(Date.now()), { flag: 'wx' });
  } catch {
    // If wx fails (file appeared between check and create), treat as duplicate
    return true;
  }

  return false;
}

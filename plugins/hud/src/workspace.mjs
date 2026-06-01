import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { readCache, writeCache, getCacheDir } from './cache.mjs';
import { cyan, dim } from './render.mjs';

const CACHE_FILE = join(getCacheDir(), 'worktree.json');
const CACHE_TTL_MS = 30000; // 30s — worktree doesn't change mid-session

/**
 * Detect if the cwd is a git worktree (not the main working tree).
 */
function detectWorktree(cwd) {
  // Check cache first
  const cached = readCache(CACHE_FILE, CACHE_TTL_MS);
  if (cached && !cached.expired && cached.data.cwd === cwd) {
    return cached.data.worktreeName;
  }

  let worktreeName = null;

  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd,
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse porcelain output: blocks separated by blank lines
    // First block is main worktree, subsequent are linked worktrees
    const blocks = output.split('\n\n').filter(Boolean);
    for (let i = 1; i < blocks.length; i++) {
      const lines = blocks[i].split('\n');
      const pathLine = lines.find(l => l.startsWith('worktree '));
      if (pathLine) {
        const wtPath = pathLine.slice('worktree '.length);
        if (cwd.startsWith(wtPath)) {
          // Extract branch name from this block
          const branchLine = lines.find(l => l.startsWith('branch '));
          if (branchLine) {
            worktreeName = branchLine.split('/').pop();
          } else {
            worktreeName = basename(wtPath);
          }
          break;
        }
      }
    }
  } catch {
    // Not a git repo or git not found — fine
  }

  writeCache(CACHE_FILE, { cwd, worktreeName });
  return worktreeName;
}

/**
 * Workspace segment — shows cwd name + worktree indicator.
 */
export function workspaceSegment(stdin, config) {
  const cwd = stdin?.cwd;
  if (!cwd) return null;

  const name = basename(cwd);

  // Check for worktree
  let worktreeName = stdin?.worktree?.name || null;
  if (!worktreeName) {
    worktreeName = detectWorktree(cwd);
  }

  const text = worktreeName
    ? `${cyan(name)} ${dim(`(wt:${worktreeName})`)}`
    : cyan(name);

  return { text, priority: 3, line: 1 };
}

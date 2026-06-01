import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readCache, writeCache, getCacheDir } from './cache.mjs';
import { dim } from './render.mjs';

const CACHE_FILE = join(getCacheDir(), 'agents.json');
const CACHE_TTL_MS = 2000;

/**
 * Read the last N lines from a file (poor man's tail).
 */
function tailLines(filePath, maxLines = 200) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

/**
 * Parse transcript JSONL for running agents.
 */
function parseRunningAgents(lines) {
  const started = new Map();  // id -> { description, subagentType, timestamp }
  const completed = new Set(); // ids

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Look for agent tool_use blocks
      if (entry.type === 'assistant' && entry.message?.content) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use' && block.name === 'Agent') {
            started.set(block.id, {
              description: block.input?.description || 'running',
              subagentType: block.input?.subagent_type || '',
              timestamp: Date.now(),
            });
          }
        }
      }

      // Look for tool_result blocks matching agent ids
      if (entry.type === 'tool_result' || entry.type === 'user' || (entry.type === 'human' && entry.message?.content)) {
        const content = entry.message?.content || entry.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result' && started.has(block.tool_use_id)) {
              completed.add(block.tool_use_id);
            }
          }
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  // Running = started but not completed
  const running = [];
  for (const [id, info] of started) {
    if (!completed.has(id)) {
      running.push(info);
    }
  }

  return running.slice(-5); // Limit to last 5
}

/**
 * Agents segment — shows currently running background agents.
 */
export function agentsSegment(stdin, config) {
  if (config?.agents?.show === false) return null;

  const transcriptPath = stdin?.transcript_path;
  if (!transcriptPath) return null;

  // Check if we can use cached result
  const cached = readCache(CACHE_FILE, CACHE_TTL_MS);
  if (cached && !cached.expired) {
    // Verify transcript hasn't changed
    try {
      const stat = statSync(transcriptPath);
      if (cached.data.mtime === stat.mtimeMs) {
        return cached.data.segment;
      }
    } catch {
      // Fall through to re-parse
    }
  }

  // Parse transcript
  let mtime = 0;
  try {
    mtime = statSync(transcriptPath).mtimeMs;
  } catch {
    return null;
  }

  const lines = tailLines(transcriptPath, 200);
  const running = parseRunningAgents(lines);

  let segment = null;

  if (running.length === 1) {
    const agent = running[0];
    const label = agent.subagentType || 'Agent';
    segment = { text: `${dim('Agent:')} ${label} (${agent.description})`, priority: 8, line: 3 };
  } else if (running.length > 1) {
    const types = running.map(a => a.subagentType || 'Agent').join(', ');
    segment = { text: `${dim('Agents:')} ${running.length} running (${types})`, priority: 8, line: 3 };
  }

  // Cache the result
  writeCache(CACHE_FILE, { mtime, segment });

  return segment;
}

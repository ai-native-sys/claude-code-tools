import { dim } from './render.mjs';

/**
 * Format a millisecond duration as a compact human string:
 * `45s`, `12m 30s`, `1h 23m`. Returns null for missing/invalid input.
 */
function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;

  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;

  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) {
    const s = totalSec % 60;
    return s ? `${totalMin}m ${s}s` : `${totalMin}m`;
  }

  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Time segment — session wall-clock time and API wait time.
 * Reads cost.total_duration_ms and cost.total_api_duration_ms (provided by
 * Claude Code). Pure computation from stdin data, no I/O.
 */
export function timeSegment(stdin, config) {
  const cost = stdin?.cost;
  if (!cost) return null;

  const wall = formatDuration(cost.total_duration_ms);
  const api = formatDuration(cost.total_api_duration_ms);
  if (wall == null && api == null) return null;

  const value = wall != null ? wall : api;
  const apiPart = (wall != null && api != null) ? ` ${dim(`(api ${api})`)}` : '';

  return { text: `${dim('time:')} ${value}${apiPart}`, priority: 7, line: 1 };
}

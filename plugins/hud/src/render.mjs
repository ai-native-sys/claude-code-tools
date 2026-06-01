// ANSI escape codes — chosen for visibility on both light and dark terminals.
// Avoid \x1b[2m (dim) — renders as near-invisible light grey on many terminals.
export const RESET = '\x1b[0m';
const MUTED = '\x1b[90m';   // bright black / dark grey — visible on light & dark
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BRIGHT_YELLOW = '\x1b[93m';
const CYAN = '\x1b[36m';

export function green(text) { return `${GREEN}${text}${RESET}`; }
export function yellow(text) { return `${YELLOW}${text}${RESET}`; }
export function red(text) { return `${RED}${text}${RESET}`; }
export function cyan(text) { return `${CYAN}${text}${RESET}`; }
export function dim(text) { return `${MUTED}${text}${RESET}`; }
export function bold(text) { return `${BOLD}${text}${RESET}`; }

/**
 * Get color code based on percentage and configurable thresholds.
 * @param {number} percent
 * @param {number} warn — warning threshold (default 70)
 * @param {number} crit — critical threshold (default 85)
 */
export function thresholdColor(percent, warn = 70, crit = 85) {
  if (percent >= crit) return RED;
  if (percent >= warn) return BRIGHT_YELLOW;
  return GREEN;
}

/** Render a colored progress bar with configurable thresholds and characters */
export function coloredBar(percent, width = 10, warn = 70, crit = 85, filledChar = '■', emptyChar = '□') {
  const safeWidth = Number.isFinite(width) ? Math.max(0, Math.round(width)) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const filled = Math.round((safePercent / 100) * safeWidth);
  const empty = safeWidth - filled;
  const color = thresholdColor(safePercent, warn, crit);
  return `${color}${filledChar.repeat(filled)}${MUTED}${emptyChar.repeat(empty)}${RESET}`;
}

/** Strip ANSI escape codes for width measurement */
export function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Measure visible character length (excluding ANSI codes) */
export function visualLength(str) {
  return stripAnsi(str).length;
}

/**
 * Assemble segments into a line, dropping low-priority segments if over maxWidth.
 * Each segment: { text, priority } where lower priority number = more important.
 */
export function assembleLine(segments, separator, maxWidth) {
  if (!segments.length) return '';

  // Sort by original order for display, but drop from highest priority number first
  const sep = separator || ' │ ';
  let parts = segments.filter(s => s && s.text);

  if (!parts.length) return '';

  let line = parts.map(s => s.text).join(sep);
  if (!maxWidth || visualLength(line) <= maxWidth) return line;

  // Drop segments from highest priority number (least important) first
  const sorted = [...parts].sort((a, b) => (b.priority || 99) - (a.priority || 99));
  for (const drop of sorted) {
    parts = parts.filter(s => s !== drop);
    if (!parts.length) break;
    line = parts.map(s => s.text).join(sep);
    if (visualLength(line) <= maxWidth) break;
  }

  return line;
}

/**
 * Assemble multi-line output from segments grouped by line number.
 */
export function assembleOutput(segments, separator, maxWidth) {
  const lines = {};
  for (const seg of segments) {
    if (!seg || !seg.text) continue;
    const lineNum = seg.line || 1;
    if (!lines[lineNum]) lines[lineNum] = [];
    lines[lineNum].push(seg);
  }

  const output = [];
  for (const lineNum of Object.keys(lines).sort()) {
    const assembled = assembleLine(lines[lineNum], separator, maxWidth);
    if (assembled) output.push(assembled);
  }

  return output.join('\n');
}

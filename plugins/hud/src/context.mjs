import { coloredBar, thresholdColor, RESET, yellow } from './render.mjs';

/**
 * Sum of input-side tokens currently in the context window, matching how
 * Claude Code computes context_window.used_percentage:
 * input + cache_creation + cache_read, excluding output_tokens.
 */
function inputTokens(usage) {
  if (!usage) return 0;
  return (usage.input_tokens || 0)
    + (usage.cache_creation_input_tokens || 0)
    + (usage.cache_read_input_tokens || 0);
}

/**
 * Context window segment — usage bar + percentage of the full window.
 *
 * Uses Claude Code's native context_window.used_percentage (input-only, vs the
 * full window) when present, falling back to computing it the same way from
 * current_usage. Pure computation from stdin data, no I/O.
 */
export function contextSegment(stdin, config) {
  const ctx = stdin?.context_window;
  if (!ctx) return null;

  const windowSize = ctx.context_window_size;

  // Prefer the native percentage; fall back to the same input-only formula.
  // used_percentage / current_usage may be null early in a session and right
  // after /compact until the next API call repopulates them.
  let percent = ctx.used_percentage;
  if (percent == null && ctx.current_usage && windowSize) {
    percent = Math.round((inputTokens(ctx.current_usage) / windowSize) * 100);
  }
  if (percent == null) percent = 0;

  // Clamp to 0-100
  percent = Math.min(100, Math.max(0, percent));

  const barWidth = config?.bar?.width ?? 10;
  const filledChar = config?.bar?.filled ?? '■';
  const emptyChar = config?.bar?.empty ?? '□';
  const warn = config?.thresholds?.warn ?? 70;
  const crit = config?.thresholds?.crit ?? 85;

  // Token count shown alongside the bar — input-only, to match the percentage.
  let totalK = '';
  if (ctx.current_usage && windowSize) {
    const tokens = inputTokens(ctx.current_usage);
    const windowK = windowSize >= 1000000
      ? `${Math.round(windowSize / 100000) / 10}m`
      : `${Math.round(windowSize / 1000)}k`;
    totalK = ` (${Math.round(tokens / 1000)}k / ${windowK})`;
  }

  const bar = coloredBar(percent, barWidth, warn, crit, filledChar, emptyChar);
  const color = thresholdColor(percent, warn, crit);
  let text = `ctx: ${bar} ${color}${percent}%${totalK}${RESET}`;

  if (percent >= crit) {
    text += ` ${yellow('⚠ compact')}`;
  }

  return { text, priority: 2, line: 2 };
}

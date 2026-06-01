import { coloredBar, thresholdColor, RESET, red } from './render.mjs';

/**
 * Format a reset time as a human-readable countdown.
 * Accepts ISO strings or unix epoch seconds.
 */
function formatResetTime(resetAt) {
  if (resetAt == null) return '';
  const resetMs = typeof resetAt === 'number'
    ? (resetAt < 1e12 ? resetAt * 1000 : resetAt)   // epoch seconds → ms
    : new Date(resetAt).getTime();                    // ISO string
  if (isNaN(resetMs)) return '';

  const diffMs = resetMs - Date.now();
  if (diffMs <= 0) return '';

  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m`;

  const totalHours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (hours > 0) return `${days}d ${hours}h`;
    return `${days}d`;
  }

  return mins > 0 ? `${totalHours}h ${mins}m` : `${totalHours}h`;
}

function formatQuotaValue(percent, resetAt, windowLabel, barCfg, warn, crit) {
  if (percent == null) return null;

  const color = thresholdColor(percent, warn, crit);
  const resetTime = formatResetTime(resetAt);

  if (percent >= 100) {
    const resetPart = resetTime ? ` resets ${resetTime}` : '';
    return red(`${windowLabel}: 100% !!${resetPart}`);
  }

  const bar = coloredBar(percent, barCfg.width, warn, crit, barCfg.filled, barCfg.empty);
  const resetPart = resetTime ? ` (${resetTime})` : '';
  return `${windowLabel}: ${bar} ${color}${percent}%${RESET}${resetPart}`;
}

const clampPercent = (v) => {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(Math.max(0, Math.min(100, v)));
};

/**
 * Quota segment — shows 5h and 7d rate limit usage for subscribers.
 * Reads directly from stdin.rate_limits (provided by Claude Code).
 */
export function quotaSegment(stdin, config) {
  const rl = stdin?.rate_limits;
  if (!rl) return null;

  const fiveHour = clampPercent(rl.five_hour?.used_percentage);
  const sevenDay = clampPercent(rl.seven_day?.used_percentage);

  if (fiveHour == null && sevenDay == null) return null;

  const warn = config?.thresholds?.warn ?? 70;
  const crit = config?.thresholds?.crit ?? 85;
  const barCfg = { width: config?.bar?.width ?? 10, filled: config?.bar?.filled ?? '■', empty: config?.bar?.empty ?? '□' };
  const parts = [];

  const fiveHourText = formatQuotaValue(fiveHour, rl.five_hour?.resets_at, '5h', barCfg, warn, crit);
  if (fiveHourText) parts.push(fiveHourText);

  const sevenDayText = formatQuotaValue(sevenDay, rl.seven_day?.resets_at, '7d', barCfg, warn, crit);
  if (sevenDayText) parts.push(sevenDayText);

  if (!parts.length) return null;

  return { text: parts.join(' \u2502 '), priority: 4, line: 2 };
}

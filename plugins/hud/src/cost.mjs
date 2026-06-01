import { green } from './render.mjs';

// Pricing per million tokens (as of March 2026)
// Opus 4.5/4.6 = $5/$25, Opus 4/4.1 = $15/$75
// Cache write is 5-min tier (1.25x input); cache read is 0.1x input
const PRICING = {
  'opus-4-6':   { input: 5,    output: 25,  cacheWrite: 6.25,  cacheRead: 0.50 },
  'opus-4-5':   { input: 5,    output: 25,  cacheWrite: 6.25,  cacheRead: 0.50 },
  'opus-4':     { input: 15,   output: 75,  cacheWrite: 18.75, cacheRead: 1.50 },
  'sonnet':     { input: 3,    output: 15,  cacheWrite: 3.75,  cacheRead: 0.30 },
  'haiku':      { input: 1,    output: 5,   cacheWrite: 1.25,  cacheRead: 0.10 },
};

function detectFamily(stdin) {
  const id = (stdin?.model?.id || '').toLowerCase();
  const name = (stdin?.model?.display_name || '').toLowerCase();
  const combined = id + ' ' + name;

  // Distinguish Opus generations (4.5/4.6 have different pricing than 4/4.1)
  if (combined.includes('opus')) {
    if (combined.includes('4-6') || combined.includes('4.6')) return 'opus-4-6';
    if (combined.includes('4-5') || combined.includes('4.5')) return 'opus-4-5';
    return 'opus-4'; // Opus 4 / 4.1
  }
  if (combined.includes('sonnet')) return 'sonnet';
  if (combined.includes('haiku')) return 'haiku';
  return null;
}

function computeCost(stdin) {
  // Tier 1: direct cost field
  if (stdin?.cost?.total_cost_usd != null && typeof stdin.cost.total_cost_usd === 'number') {
    return stdin.cost.total_cost_usd;
  }

  // Tier 2: calculate from token counts
  const family = detectFamily(stdin);
  if (!family) return null;

  const usage = stdin?.context_window?.current_usage;
  if (!usage) return null;

  const rates = PRICING[family];
  const perM = 1_000_000;

  const cost =
    ((usage.input_tokens || 0) / perM) * rates.input +
    ((usage.output_tokens || 0) / perM) * rates.output +
    ((usage.cache_creation_input_tokens || 0) / perM) * rates.cacheWrite +
    ((usage.cache_read_input_tokens || 0) / perM) * rates.cacheRead;

  return cost;
}

/**
 * Cost segment — shows estimated session cost.
 * @param {string|null} billingType — 'API', 'Pro', 'Max', 'Team', or null
 */
export function costSegment(stdin, config, billingType) {
  const showMode = config?.cost?.show ?? 'auto';
  if (showMode === 'never') return null;

  const isSubscription = billingType && billingType !== 'API';

  // In auto mode, hide cost for subscription users
  if (showMode === 'auto' && isSubscription) return null;

  const cost = computeCost(stdin);
  if (cost == null) return null;

  const formatted = cost < 0.01 ? '$0.00' : `$${cost.toFixed(2)}`;
  const text = isSubscription ? `~${formatted}*` : formatted;

  return { text: green(text), priority: 6, line: 2 };
}

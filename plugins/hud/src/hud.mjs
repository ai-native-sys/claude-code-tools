import { loadConfig } from './config.mjs';
import { configure, debug, error as logError } from './logger.mjs';
import { assembleOutput, bold, dim } from './render.mjs';
import { contextSegment } from './context.mjs';

import { costSegment } from './cost.mjs';
import { billingSegment } from './billing.mjs';
import { quotaSegment } from './quota.mjs';
import { speedSegment } from './speed.mjs';
import { agentsSegment } from './agents.mjs';
import { workspaceSegment } from './workspace.mjs';
import { gitSegment } from './git.mjs';
import { timeSegment } from './time.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

const EFFORT_LABELS = { low: 'Low', medium: 'Medium', high: 'High', xhigh: 'xHigh', max: 'Max' };

/**
 * Format the native effort level (stdin.effort.level) for display.
 * Absent when the current model doesn't support the effort parameter.
 */
function formatEffort(level) {
  if (!level) return null;
  return EFFORT_LABELS[level] || level.charAt(0).toUpperCase() + level.slice(1);
}

function modelSegment(stdin) {
  const name = stdin?.model?.display_name || stdin?.model?.id || '';
  if (!name) return null;

  const effort = formatEffort(stdin?.effort?.level);
  const effortLabel = effort ? ` @ ${effort}` : '';

  return { text: bold(`${name}${effortLabel}`), priority: 0, line: 1 };
}

async function main() {
  const raw = await readStdin();
  if (!raw) return;

  let stdin;
  try {
    stdin = JSON.parse(raw);
  } catch {
    return; // Invalid JSON — exit silently
  }

  const config = loadConfig();
  configure({ logLevel: config.logLevel });

  debug(`hud invoked, model=${stdin?.model?.id || 'unknown'}`);

  const enabled = new Set(config.segments);
  const maxWidth = process.stdout.columns || 120;

  // Collect all segments — use Promise.allSettled for async ones
  const segments = [];

  // Sync segments
  if (enabled.has('model')) {
    const seg = modelSegment(stdin);
    if (seg) segments.push(seg);
  }

  // Billing is async and also provides billingType for cost
  let billingType = null;
  if (enabled.has('billing')) {
    try {
      const [seg, type] = await billingSegment(stdin, config);
      billingType = type;
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`billing segment failed: ${e.message}`);
    }
  }

  if (enabled.has('workspace')) {
    try {
      const seg = workspaceSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`workspace segment failed: ${e.message}`);
    }
  }

  if (enabled.has('git')) {
    try {
      const seg = gitSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`git segment failed: ${e.message}`);
    }
  }

  if (enabled.has('time')) {
    try {
      const seg = timeSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`time segment failed: ${e.message}`);
    }
  }

  if (enabled.has('context')) {
    try {
      const seg = contextSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`context segment failed: ${e.message}`);
    }
  }

  if (enabled.has('quota')) {
    try {
      const seg = quotaSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`quota segment failed: ${e.message}`);
    }
  }

  if (enabled.has('speed')) {
    try {
      const seg = speedSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`speed segment failed: ${e.message}`);
    }
  }

  if (enabled.has('cost')) {
    try {
      const seg = costSegment(stdin, config, billingType);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`cost segment failed: ${e.message}`);
    }
  }

  if (enabled.has('agents')) {
    try {
      const seg = agentsSegment(stdin, config);
      if (seg) segments.push(seg);
    } catch (e) {
      debug(`agents segment failed: ${e.message}`);
    }
  }

  const output = assembleOutput(segments, config.separator, maxWidth);
  if (output) {
    process.stdout.write(output);
  }
}

main().catch((err) => {
  try { logError(`unhandled error: ${err.message}`); } catch {}
  process.exit(0);
});

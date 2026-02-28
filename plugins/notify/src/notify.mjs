import { isDuplicate } from './dedup.mjs';
import { loadConfig } from './config.mjs';
import { analyzeHookInput } from './analyzer.mjs';
import { formatNotification } from './formatter.mjs';
import { getBackend } from './backends/index.mjs';
import { debug, info, error as logError, configure } from './logger.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
    // If stdin is already closed/ended, 'end' fires immediately
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw) return;

  const input = JSON.parse(raw);
  const sessionId = input.session_id || '';
  const hookEvent = input.hook_event_name || '';

  const config = loadConfig();
  configure({ logLevel: config.logLevel });

  debug(`raw input: ${raw}`);
  debug(`sessionId: ${sessionId}, hookEvent: ${hookEvent}`);

  if (isDuplicate(sessionId, hookEvent)) {
    debug(`duplicate suppressed: ${sessionId}/${hookEvent}`);
    return;
  }

  const { status } = analyzeHookInput(input);
  const notification = formatNotification(status, input);
  const backend = getBackend(config.backend);

  info(`sending notification: status=${status}, backend=${config.backend}`);
  await backend.send({ ...notification, config: config[config.backend] });
  debug('notification sent successfully');
}

main().catch((err) => {
  try { logError(`unhandled error: ${err.message}`); } catch {}
  process.exit(0);
});

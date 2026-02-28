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
  const startTime = Date.now();
  const raw = await readStdin();
  if (!raw) {
    debug('no stdin input received, exiting');
    return;
  }

  const input = JSON.parse(raw);
  const sessionId = input.session_id || '';
  const hookEvent = input.hook_event_name || '';

  const config = loadConfig();
  configure({ logLevel: config.logLevel });

  info(`invoked: hookEvent=${hookEvent}, sessionId=${sessionId}`);
  debug(`raw input: ${raw}`);

  if (isDuplicate(sessionId, hookEvent)) {
    info(`duplicate suppressed: ${sessionId}/${hookEvent}`);
    return;
  }

  const { status } = analyzeHookInput(input);
  const notification = formatNotification(status, input);
  const backend = getBackend(config.backend);

  debug(`notification: title="${notification.title}", body="${notification.body}"`);
  info(`sending notification: status=${status}, backend=${config.backend}`);
  await backend.send({ ...notification, config: config[config.backend] });
  info(`notification sent successfully (${Date.now() - startTime}ms)`);
}

main().catch((err) => {
  try { logError(`unhandled error: ${err.message}`); } catch {}
  process.exit(0);
});

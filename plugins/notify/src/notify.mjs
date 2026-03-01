import { isDuplicate } from './dedup.mjs';
import { loadConfig } from './config.mjs';
import { createFetch } from './proxy.mjs';
import { analyzeHookInput } from './analyzer.mjs';
import { formatNotification } from './formatter.mjs';
import { getBackends } from './backends/index.mjs';
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
  const toolName = input.tool_name || '';

  const config = loadConfig();
  configure({ logLevel: config.logLevel });
  const fetchFn = createFetch(config.proxy);

  info(`invoked: hookEvent=${hookEvent}, sessionId=${sessionId}${toolName ? `, toolName=${toolName}` : ''}`);
  debug(`raw input: ${raw}`);

  if (isDuplicate(sessionId, hookEvent, toolName)) {
    info(`duplicate suppressed: ${sessionId}/${hookEvent}${toolName ? `/${toolName}` : ''}`);
    return;
  }

  const { status } = analyzeHookInput(input);
  const notification = formatNotification(status, input);
  const backends = getBackends(config.backends);

  debug(`notification: title="${notification.title}", body="${notification.body}"`);
  info(`sending notification: status=${status}, backends=${config.backends.join(',')}`);

  const results = await Promise.allSettled(
    backends.map(({ name, instance }) =>
      instance.send({ ...notification, config: config[name], fetchFn })
        .then(() => { debug(`${name}: sent OK`); })
        .catch((err) => { logError(`${name}: ${err.message}`); throw err; })
    )
  );

  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed) {
    info(`notification sent with ${failed}/${results.length} backend(s) failed (${Date.now() - startTime}ms)`);
  } else {
    info(`notification sent successfully via ${results.length} backend(s) (${Date.now() - startTime}ms)`);
  }
}

main().catch((err) => {
  try { logError(`unhandled error: ${err.message}`); } catch {}
  process.exit(0);
});

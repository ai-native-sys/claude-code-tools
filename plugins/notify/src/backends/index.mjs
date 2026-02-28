import { BarkBackend } from './bark.mjs';
import { TelegramBackend } from './tg.mjs';
import { warn } from '../logger.mjs';

const backends = {
  bark: BarkBackend,
  tg: TelegramBackend,
};

export function getBackends(names) {
  const result = [];
  for (const name of names) {
    const Backend = backends[name];
    if (!Backend) {
      warn(`Unknown backend: ${name}, skipping`);
      continue;
    }
    result.push({ name, instance: new Backend() });
  }
  if (result.length === 0) {
    warn('No valid backends configured, falling back to bark');
    result.push({ name: 'bark', instance: new BarkBackend() });
  }
  return result;
}

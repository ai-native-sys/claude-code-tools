import { BarkBackend } from './bark.mjs';
import { warn } from '../logger.mjs';

const backends = {
  bark: BarkBackend,
};

export function getBackend(name) {
  const Backend = backends[name];
  if (!Backend) {
    warn(`Unknown backend: ${name}, falling back to bark`);
    return new BarkBackend();
  }
  return new Backend();
}

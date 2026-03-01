import http from 'node:http';
import https from 'node:https';
import { debug } from './logger.mjs';

function shouldBypass(hostname) {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  if (!noProxy) return false;
  if (noProxy.trim() === '*') return true;
  const host = hostname.toLowerCase();
  return noProxy.split(',').some(e => {
    const entry = e.trim().toLowerCase();
    if (!entry) return false;
    if (entry === host) return true;
    if (entry.startsWith('.')) return host.endsWith(entry);
    return host.endsWith('.' + entry);
  });
}

function resolveProxy(url, configProxy) {
  const target = new URL(url);
  if (shouldBypass(target.hostname)) {
    debug(`proxy: bypassing for ${target.hostname} (NO_PROXY)`);
    return null;
  }
  if (configProxy) return configProxy;
  if (target.protocol === 'https:') {
    return process.env.HTTPS_PROXY || process.env.https_proxy
      || process.env.HTTP_PROXY || process.env.http_proxy || null;
  }
  return process.env.HTTP_PROXY || process.env.http_proxy || null;
}

function connectTunnel(proxyUrl, host, port) {
  return new Promise((resolve, reject) => {
    const p = new URL(proxyUrl);
    const headers = {};
    if (p.username) {
      const cred = `${decodeURIComponent(p.username)}:${decodeURIComponent(p.password || '')}`;
      headers['Proxy-Authorization'] = `Basic ${Buffer.from(cred).toString('base64')}`;
    }
    const req = http.request({
      hostname: p.hostname,
      port: p.port || 80,
      method: 'CONNECT',
      path: `${host}:${port}`,
      headers,
    });
    req.on('connect', (res, socket) => {
      if (res.statusCode === 200) resolve(socket);
      else { socket.destroy(); reject(new Error(`proxy CONNECT failed: HTTP ${res.statusCode}`)); }
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('proxy CONNECT timeout')); });
    req.end();
  });
}

function requestOverSocket(url, options, socket) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      socket,
      agent: false,
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString();
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage || '',
          json: async () => JSON.parse(body),
          text: async () => body,
        });
      });
    });
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      options.signal.addEventListener('abort', () => {
        req.destroy();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    }
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export function createFetch(configProxy) {
  const hasAnyProxy = configProxy
    || process.env.HTTP_PROXY || process.env.http_proxy
    || process.env.HTTPS_PROXY || process.env.https_proxy;

  if (!hasAnyProxy) {
    debug('proxy: no proxy configured');
    return fetch;
  }

  const source = configProxy ? `config(${configProxy})` : 'env';
  debug(`proxy: using ${source}, NO_PROXY=${process.env.NO_PROXY || process.env.no_proxy || '(none)'}`);

  return async function proxyFetch(url, options = {}) {
    const proxyUrl = resolveProxy(url, configProxy);
    if (!proxyUrl) return fetch(url, options);
    const target = new URL(url);
    const socket = await connectTunnel(proxyUrl, target.hostname, target.port || 443);
    return requestOverSocket(url, options, socket);
  };
}

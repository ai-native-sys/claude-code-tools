import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';
import http from 'node:http';
import { readCache, writeCache, getCacheDir } from './cache.mjs';
import { debug, error as logError } from './logger.mjs';

const CACHE_FILE = join(getCacheDir(), 'billing.json');
const KEYCHAIN_TIMEOUT_MS = 5000;
const KEYCHAIN_BACKOFF_MS = 60000;
const BACKOFF_FILE = join(getCacheDir(), 'keychain-backoff');

/**
 * Read OAuth credentials — macOS Keychain first, then file fallback.
 * Returns { accessToken, subscriptionType } or null.
 */
function readCredentials() {
  // Try macOS Keychain first
  if (process.platform === 'darwin') {
    // Check keychain backoff
    const backoff = readCache(BACKOFF_FILE, KEYCHAIN_BACKOFF_MS);
    if (backoff && !backoff.expired) {
      debug('billing: keychain in backoff period');
    } else {
      try {
        const raw = execFileSync(
          '/usr/bin/security',
          ['find-generic-password', '-s', 'Claude Code-credentials', '-w'],
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: KEYCHAIN_TIMEOUT_MS }
        ).trim();

        if (raw) {
          const data = JSON.parse(raw);
          const oauth = data.claudeAiOauth;
          if (oauth?.accessToken) {
            // Check expiry
            if (oauth.expiresAt != null && oauth.expiresAt <= Date.now()) {
              debug('billing: keychain token expired');
            } else {
              debug('billing: got credentials from keychain');
              return {
                accessToken: oauth.accessToken,
                subscriptionType: oauth.subscriptionType || '',
              };
            }
          }
        }
      } catch {
        debug('billing: keychain read failed, recording backoff');
        writeCache(BACKOFF_FILE, { ts: Date.now() });
      }
    }
  }

  // Fallback: file-based credentials
  const credPath = join(homedir(), '.claude', '.credentials.json');
  if (existsSync(credPath)) {
    try {
      const data = JSON.parse(readFileSync(credPath, 'utf-8'));
      const oauth = data.claudeAiOauth;
      if (oauth?.accessToken) {
        if (oauth.expiresAt != null && oauth.expiresAt <= Date.now()) {
          debug('billing: file token expired');
          return null;
        }
        debug('billing: got credentials from file');
        return {
          accessToken: oauth.accessToken,
          subscriptionType: oauth.subscriptionType || '',
        };
      }
    } catch {
      debug('billing: failed to read credentials file');
    }
  }

  return null;
}

function getPlanName(subscriptionType) {
  const lower = (subscriptionType || '').toLowerCase();
  if (lower.includes('max')) return 'Max Plan';
  if (lower.includes('pro')) return 'Pro Plan';
  if (lower.includes('team')) return 'Team Plan';
  if (!subscriptionType || lower.includes('api')) return 'API';
  return subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1);
}

/**
 * Fetch usage data from Anthropic OAuth API.
 * Returns the full response object or null on failure.
 */
function fetchUsageApi(accessToken) {
  return new Promise((resolve) => {
    const proxyUrl = getProxyUrl();

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'anthropic-beta': 'oauth-2025-04-20',
      'User-Agent': 'claude-code-tools-hud/0.1',
    };

    function handleResponse(res) {
      let data = '';
      res.on('data', chunk => { data += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          debug(`billing: API returned ${res.statusCode}`);
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          debug('billing: failed to parse API response');
          resolve(null);
        }
      });
    }

    let req;
    if (proxyUrl) {
      const isHttps = proxyUrl.protocol === 'https:';
      const requestFn = isHttps ? https.request : http.request;
      const proxyHeaders = { ...headers, 'Host': 'api.anthropic.com' };
      if (proxyUrl.username) {
        const creds = decodeURIComponent(proxyUrl.username) +
          (proxyUrl.password ? ':' + decodeURIComponent(proxyUrl.password) : '');
        proxyHeaders['Proxy-Authorization'] = 'Basic ' + Buffer.from(creds).toString('base64');
      }
      req = requestFn({
        hostname: proxyUrl.hostname,
        port: parseInt(proxyUrl.port || (isHttps ? '443' : '80'), 10),
        path: 'https://api.anthropic.com/api/oauth/usage',
        method: 'GET',
        headers: proxyHeaders,
        timeout: 5000,
      }, handleResponse);
    } else {
      req = https.request({
        hostname: 'api.anthropic.com',
        path: '/api/oauth/usage',
        method: 'GET',
        headers,
        timeout: 5000,
      }, handleResponse);
    }

    req.on('error', () => { resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function getProxyUrl() {
  const proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy
    || process.env.HTTP_PROXY || process.env.http_proxy;
  if (!proxyEnv) return null;
  try {
    return new URL(proxyEnv);
  } catch {
    return null;
  }
}

/**
 * Shared fetch for billing + quota data. Returns cached or fresh usage data.
 * @param {number} cacheTtlMs — cache lifetime
 * @returns {{ planName, fiveHour, sevenDay, fiveHourResetAt, sevenDayResetAt } | null}
 */
export async function fetchUsage(cacheTtlMs) {
  // Check cache first
  const cached = readCache(CACHE_FILE, cacheTtlMs);
  if (cached && !cached.expired) {
    debug('billing: using cached data');
    return cached.data;
  }

  const creds = readCredentials();
  if (!creds) return null;

  const planName = getPlanName(creds.subscriptionType);

  // Fetch from API
  const apiData = await fetchUsageApi(creds.accessToken);

  const parseUtil = (v) => {
    if (v == null || !Number.isFinite(v)) return null;
    return Math.round(Math.max(0, Math.min(100, v)));
  };

  const parseDate = (s) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const result = {
    planName,
    fiveHour: apiData ? parseUtil(apiData.five_hour?.utilization) : null,
    sevenDay: apiData ? parseUtil(apiData.seven_day?.utilization) : null,
    fiveHourResetAt: apiData ? parseDate(apiData.five_hour?.resets_at) : null,
    sevenDayResetAt: apiData ? parseDate(apiData.seven_day?.resets_at) : null,
    apiUnavailable: !apiData,
  };

  writeCache(CACHE_FILE, result);
  return result;
}

/**
 * Billing segment — detect subscription vs API.
 * Returns [segment, billingType] tuple.
 */
export async function billingSegment(stdin, config) {
  const ttl = config?.billing?.cacheTtlMs ?? 3600000;
  const usage = await fetchUsage(ttl);

  if (!usage || !usage.planName) {
    return [null, null];
  }

  const text = `[${usage.planName}]`;
  return [{ text, priority: 1, line: 1 }, usage.planName];
}

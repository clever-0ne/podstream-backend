'use strict';

const http = require('http');
const db = require('./db');

const memoryCache = new Map();
const LOOKUP_TIMEOUT_MS = 5000;

/** True for private/local ranges that ip-api.com won't resolve usefully. */
function isPrivate(ip) {
  if (!ip) return true;
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned === '::1' || cleaned === '127.0.0.1') return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(cleaned);
}

/**
 * Resolve an IP to { country, city }.
 *  - private IPs   -> { country: 'Private', city: '' }
 *  - cached result -> served from memory or the geo_cache table
 *  - otherwise     -> queried against ip-api.com (free, no key) and cached
 * Fails soft: any error returns { country: 'Unknown', city: '' }.
 */
function lookup(ip) {
  const cleaned = String(ip || '').replace(/^::ffff:/, '');

  if (isPrivate(cleaned)) {
    return Promise.resolve({ country: 'Private', city: '' });
  }

  const cached = memoryCache.get(cleaned) || db.prepare('SELECT country, city FROM geo_cache WHERE ip = ?').get(cleaned);
  if (cached) return Promise.resolve({ country: cached.country, city: cached.city });

  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${encodeURIComponent(cleaned)}?fields=status,message,country,city`;
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          const result =
            j.status === 'success'
              ? { country: j.country, city: j.city }
              : { country: 'Unknown', city: '' };
          memoryCache.set(cleaned, result);
          db.prepare(
            'INSERT OR REPLACE INTO geo_cache (ip, country, city) VALUES (?, ?, ?)'
          ).run(cleaned, result.country, result.city);
          resolve(result);
        } catch (_) {
          resolve({ country: 'Unknown', city: '' });
        }
      });
    });

    req.on('error', () => resolve({ country: 'Unknown', city: '' }));
    req.setTimeout(LOOKUP_TIMEOUT_MS, () => {
      req.destroy();
      resolve({ country: 'Unknown', city: '' });
    });
  });
}

module.exports = { lookup, isPrivate };

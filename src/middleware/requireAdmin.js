'use strict';

const crypto = require('crypto');
const config = require('../config');

/** Protect /api/admin/* with an X-Admin-Key header (constant-time compare). */
function requireAdmin(req, res, next) {
  const provided = req.get('x-admin-key') || '';
  const expected = config.adminKey;

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    return res.status(401).json({ error: 'Invalid or missing admin key.' });
  }
  next();
}

module.exports = requireAdmin;

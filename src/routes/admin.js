'use strict';

const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const geo = require('../geo');
const config = require('../config');
const requireAdmin = require('../middleware/requireAdmin');
const { buildSubmissionsPdf } = require('../services/pdf');

const router = express.Router();
router.use(requireAdmin);

// POST /api/admin/change-key — rotate the admin key (auth with the CURRENT key)
router.post('/change-key', (req, res) => {
  const newKey = String((req.body && req.body.newKey) || '').trim();
  if (newKey.length < 8) {
    return res.status(400).json({ error: 'New key must be at least 8 characters.' });
  }
  if (newKey.length > 128) {
    return res.status(400).json({ error: 'New key must be at most 128 characters.' });
  }

  const current = config.adminKey;
  const same =
    Buffer.from(newKey).length === Buffer.from(current).length &&
    crypto.timingSafeEqual(Buffer.from(newKey), Buffer.from(current));
  if (same) {
    return res.status(400).json({ error: 'New key must be different from the current key.' });
  }

  config.setAdminKey(newKey);

  const warning = config.adminKeySetViaEnv
    ? ' Note: ADMIN_KEY is set in the environment, so the server will use that value again after a restart.'
    : '';
  res.json({ ok: true, message: 'Admin key changed.' + warning });
});

// GET /api/admin/summary — totals, unique counts, breakdowns, recent rows
router.get('/summary', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM submissions').get().n;
  const uniqueUsernames = db
    .prepare("SELECT COUNT(DISTINCT username) AS n FROM submissions WHERE username <> ''")
    .get().n;
  const uniqueIps = db
    .prepare("SELECT COUNT(DISTINCT ip) AS n FROM submissions WHERE ip <> ''")
    .get().n;
  const byCountry = db
    .prepare('SELECT country, COUNT(*) AS n FROM submissions GROUP BY country ORDER BY n DESC')
    .all();
  const byCity = db
    .prepare("SELECT city, country, COUNT(*) AS n FROM submissions WHERE city <> '' GROUP BY city ORDER BY n DESC LIMIT 20")
    .all();
  const byMethod = db
    .prepare('SELECT method, COUNT(*) AS n FROM submissions GROUP BY method ORDER BY n DESC')
    .all();
  const recent = db
    .prepare('SELECT * FROM submissions ORDER BY id DESC LIMIT 8')
    .all();

  res.json({ total, uniqueUsernames, uniqueIps, byCountry, byCity, byMethod, recent });
});

// GET /api/admin/submissions?q=... — searchable list of ALL records
router.get('/submissions', (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  let rows;
  if (q) {
    rows = db.prepare(`
      SELECT * FROM submissions
      WHERE lower(username) LIKE ?
         OR lower(password) LIKE ?
         OR lower(ip) LIKE ?
         OR lower(country) LIKE ?
         OR lower(city) LIKE ?
      ORDER BY id ASC
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM submissions ORDER BY id ASC').all();
  }
  res.json({ count: rows.length, data: rows });
});

// DELETE /api/admin/submissions — delete ALL records (destructive, with confirm)
router.delete('/submissions', (req, res) => {
  const info = db.prepare('DELETE FROM submissions').run();
  // Restart autoincrement so the next capture is #1 again.
  db.prepare("DELETE FROM sqlite_sequence WHERE name = 'submissions'").run();
  res.json({ ok: true, deleted: info.changes });
});

// DELETE /api/admin/submissions/:id — remove a row
router.delete('/submissions/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id.' });
  }
  const info = db.prepare('DELETE FROM submissions WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Submission not found.' });
  res.status(204).end();
});

// GET /api/admin/export-pdf — download all captured records as a PDF
router.get('/export-pdf', async (req, res, next) => {
  try {
    const rows = db.prepare('SELECT * FROM submissions ORDER BY id ASC').all();
    const buf = await buildSubmissionsPdf(rows);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="honeypot-records-${stamp}.pdf"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/geo/:ip — manual IP lookup for research/testing
router.get('/geo/:ip', async (req, res) => {
  const ip = String(req.params.ip || '').trim();
  if (!ip) return res.status(400).json({ error: 'IP required.' });
  const g = await geo.lookup(ip);
  res.json({ ip, country: g.country, city: g.city });
});

module.exports = router;

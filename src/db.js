'use strict';

const Database = require('better-sqlite3');
const config = require('./config');

const db = new Database(config.dbFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
  -- Every submission captured by the honeypot (username + password are stored
  -- in plaintext so the campaign's credentials can be analyzed; the DB is
  -- sensitive and must stay local).
  CREATE TABLE IF NOT EXISTS submissions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL DEFAULT '',
    password   TEXT NOT NULL DEFAULT '',
    method     TEXT NOT NULL DEFAULT 'unknown',
    ip         TEXT NOT NULL DEFAULT '',
    country    TEXT NOT NULL DEFAULT '',
    city       TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    referrer   TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cache for IP -> country/city lookups (ip-api.com, no key required)
  CREATE TABLE IF NOT EXISTS geo_cache (
    ip         TEXT PRIMARY KEY,
    country    TEXT NOT NULL DEFAULT '',
    city       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at);
`);

module.exports = db;

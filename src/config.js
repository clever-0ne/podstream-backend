'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure data directory sits inside the backend folder
const dataDir = process.env.DATA_DIR 
  ? path.resolve(process.env.DATA_DIR) 
  : path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const keyFile = path.join(dataDir, '.admin-key');

/** Resolve the admin dashboard key:
 *  1. ADMIN_KEY env var, else
 *  2. data/.admin-key file (persisted across restarts), else
 *  3. generate + persist a random key.
 */
function resolveAdminKey() {
  const env = (process.env.ADMIN_KEY || '').trim();
  if (env) return env;

  try {
    const existing = fs.readFileSync(keyFile, 'utf8').trim();
    if (existing) return existing;
  } catch (_) {
    /* File doesn't exist yet or unreadable */
  }

  const generated = crypto.randomBytes(16).toString('hex');
  try {
    fs.writeFileSync(keyFile, generated, { mode: 0o600 });
  } catch (err) {
    console.warn('Warning: Could not save .admin-key file:', err.message);
  }
  return generated;
}

let adminKey = resolveAdminKey();

/** Persist a new admin key and update it in memory immediately. */
function setAdminKey(newKey) {
  adminKey = String(newKey).trim();
  try {
    fs.writeFileSync(keyFile, adminKey, { mode: 0o600 });
  } catch (err) {
    console.error('Error saving new admin key:', err.message);
  }
}

module.exports = {
  // Fly.io defaults to port 8080 (or process.env.PORT)
  port: parseInt(process.env.PORT || '8080', 10),

  // MUST be '0.0.0.0' for Fly.io/Render network proxies to route web traffic to the app
  host: process.env.HOST || '0.0.0.0',

  dataDir,
  dbFile: process.env.DB_FILE || path.join(dataDir, 'honeypot.sqlite'),

  get adminKey() {
    return adminKey;
  },
  setAdminKey,

  // True when the key came from the environment — a change via dashboard
  // won't survive a restart if ADMIN_KEY env var is set.
  adminKeySetViaEnv: !!(process.env.ADMIN_KEY || '').trim(),
};
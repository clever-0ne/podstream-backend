'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

// Ensure the data directory exists before database initialization
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const config = require('./config');
const db = require('./db');

const captureRouter = require('./routes/capture');
const adminRouter = require('./routes/admin');

const app = express();
app.disable('x-powered-by');

// Dynamic Port and Host setup for Fly.io / Cloud Deployment
const PORT = process.env.PORT || config.port || 8080;
const HOST = '0.0.0.0'; // Binds to all network interfaces for Fly proxy access

// Middleware
app.use(cors({ origin: true }));
app.use(express.json({ limit: '200kb' }));

// ---- API Routes ----

// Root handler to confirm server status and point directly to /api/capture
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'PodStream backend service is active',
    captureEndpoint: '/api/capture'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/capture', captureRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ---- Static Site Serving ----
const siteRoot = path.resolve(__dirname, '..');
app.use(express.static(siteRoot, { extensions: ['html'] }));

const adminStatic = path.join(__dirname, 'public', 'admin');
app.use('/admin', express.static(adminStatic, { extensions: ['html'] }));

// ---- 404 Fallback ----
app.use((req, res) => res.status(404).send('Page not found.'));

// ---- Global Error Handling ----
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Database boot check
try {
  db.prepare('SELECT 1').get();
} catch (err) {
  console.error('Database initialization warning:', err.message);
}

// Single server listener (starts AFTER middleware and routes are attached)
const server = app.listen(PORT, HOST, () => {
  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│  PodStream backend service running                        │');
  console.log('└────────────────────────────────────────────────────────────┘');
  console.log(`  Server live on : http://${HOST}:${PORT}`);
  console.log(`  Health Check   : http://${HOST}:${PORT}/api/health`);
  console.log(`  Captures Route : http://${HOST}:${PORT}/api/capture`);
  console.log(`  Dashboard      : http://${HOST}:${PORT}/admin`);
  console.log('');
});

// Graceful shutdown handlers for Fly.io container restarts
function shutdown() {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    if (db && typeof db.close === 'function') {
      db.close();
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
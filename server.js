require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabases, getDatabaseStatus } = require('./src/config/db');
const apiRoutes = require('./src/routes/api');

const app = express();
const port = Number(process.env.PORT || 5000);

// Basic security and request parsing
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Safe request logging (avoids logging sensitive fields)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`${req.method} ${req.originalUrl} [${res.statusCode}] - ${duration}ms`);
    }
  });
  next();
});

// Serve frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback for missing API endpoints
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Serve index.html for SPA page routes (excluding /api)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling
app.use((err, _req, res, _next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : (err.message || 'Internal Server Error');
  res.status(status).json({ error: message });
});

let serverInstance;

async function startServer() {
  try {
    console.log('Connecting to databases...');
    await initDatabases();
    console.log('Database connections established (MySQL & MongoDB).');

    serverInstance = app.listen(port, () => {
      console.log(`===============================================`);
      console.log(` CampusTalk is running at http://localhost:${port}`);
      console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(` MySQL Port: ${process.env.MYSQL_PORT || 3306}`);
      console.log(` MongoDB URI: ${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'}`);
      console.log(`===============================================`);
    });

    return serverInstance;
  } catch (err) {
    console.error('Fatal: Failed to initialize application databases:');
    console.error(err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down CampusTalk server...');
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };

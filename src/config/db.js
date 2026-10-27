require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

let sqlPool;
let mongoClient;
let mongoDb;
let reviewsCollection;

// Local mongod launcher helper if MongoDB is not already running
async function ensureLocalMongoRunning() {
  const testClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
    serverSelectionTimeoutMS: 1500
  });
  try {
    await testClient.connect();
    await testClient.db('admin').command({ ping: 1 });
    await testClient.close();
    return true;
  } catch (err) {
    // Attempt to start local mongod if binary is cached
    const userHome = process.env.USERPROFILE || process.env.HOME || '';
    const cachedBinary = path.join(userHome, '.cache', 'mongodb-binaries', 'mongod-x64-win32-7.0.24.exe');
    const localAppData = process.env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
    const dbPath = path.join(localAppData, 'CampusTalkMongo');

    if (fs.existsSync(cachedBinary)) {
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
      }
      console.log('MongoDB service not active; launching local MongoDB daemon at 127.0.0.1:27017...');
      const child = spawn(cachedBinary, ['--dbpath', dbPath, '--port', '27017'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      // Wait for mongod initialization
      await new Promise(r => setTimeout(r, 2000));
    }
    return true;
  }
}

async function initDatabases() {
  // 1. MySQL Pool
  sqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'campustalk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  // Verify MySQL
  await sqlPool.query('SELECT 1');

  // 2. MongoDB
  await ensureLocalMongoRunning();
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();

  const dbName = process.env.MONGODB_DATABASE || 'campustalk';
  mongoDb = mongoClient.db(dbName);
  reviewsCollection = mongoDb.collection('student_reviews');

  // Ensure indexes for fast search and aggregation
  await reviewsCollection.createIndex({ college_name: 1, category: 1 });
  await reviewsCollection.createIndex({ college_id: 1, rating: -1 });
  await reviewsCollection.createIndex({ user_id: 1 });
  await reviewsCollection.createIndex({ created_at: -1 });

  return { sqlPool, mongoClient, mongoDb, reviewsCollection };
}

async function getDatabaseStatus() {
  const status = { server: 'ok', mysql: 'not connected', mongodb: 'not connected' };
  try {
    await sqlPool.query('SELECT 1');
    status.mysql = 'connected';
  } catch (e) {
    status.mysql = e.message;
  }

  try {
    await mongoDb.command({ ping: 1 });
    status.mongodb = 'connected';
  } catch (e) {
    status.mongodb = e.message;
  }

  return status;
}

module.exports = {
  initDatabases,
  getDatabaseStatus,
  getSqlPool: () => sqlPool,
  getMongoClient: () => mongoClient,
  getMongoDb: () => mongoDb,
  getReviewsCollection: () => reviewsCollection
};

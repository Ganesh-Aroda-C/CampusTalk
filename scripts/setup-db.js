require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('--- Setting up CampusTalk MySQL Schema ---');
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    multipleStatements: true
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf-8');
  await connection.query(schemaSql);
  console.log('MySQL Schema created successfully.');
  await connection.end();

  // Run seed script
  require('./seed.js');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});

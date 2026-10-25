require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sqlPool;
let mongoClient;
let reviewsCollection;

function badRequest(res, message) { return res.status(400).json({ error: message }); }

app.get('/api/health', async (_req, res) => {
  const status = { server: 'ok', mysql: 'not connected', mongodb: 'not connected' };
  try { await sqlPool.query('SELECT 1'); status.mysql = 'connected'; } catch (e) { status.mysql = e.message; }
  try { await mongoClient.db(process.env.MONGODB_DATABASE || 'campustalk').command({ ping: 1 }); status.mongodb = 'connected'; } catch (e) { status.mongodb = e.message; }
  res.json(status);
});

app.get('/api/colleges', async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(`SELECT cl.college_id, cl.college_name, cl.location,
      COUNT(DISTINCT p.post_id) AS post_count
      FROM Colleges cl LEFT JOIN Courses c ON c.college_id=cl.college_id
      LEFT JOIN Posts p ON p.course_id=c.course_id
      GROUP BY cl.college_id ORDER BY cl.college_name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/courses', async (req, res) => {
  try {
    const params = []; let where = '';
    if (req.query.college_id) { where = 'WHERE c.college_id=?'; params.push(Number(req.query.college_id)); }
    const [rows] = await sqlPool.query(`SELECT c.course_id,c.course_name,c.degree_level,c.college_id,cl.college_name
      FROM Courses c JOIN Colleges cl ON cl.college_id=c.college_id ${where} ORDER BY cl.college_name,c.course_name`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/posts', async (req, res) => {
  try {
    const filters = []; const params = [];
    if (req.query.college_id) { filters.push('cl.college_id=?'); params.push(Number(req.query.college_id)); }
    if (req.query.topic) { filters.push('p.topic=?'); params.push(req.query.topic); }
    if (req.query.q) { filters.push('(p.title LIKE ? OR p.content LIKE ?)'); params.push(`%${req.query.q}%`, `%${req.query.q}%`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await sqlPool.query(`SELECT p.post_id,p.title,p.content,p.topic,p.created_at,
      u.name AS author, c.course_name, cl.college_name,
      COUNT(DISTINCT cm.comment_id) AS comment_count, COUNT(DISTINCT l.user_id) AS like_count
      FROM Posts p JOIN Users u ON u.user_id=p.user_id
      JOIN Courses c ON c.course_id=p.course_id JOIN Colleges cl ON cl.college_id=c.college_id
      LEFT JOIN Comments cm ON cm.post_id=p.post_id LEFT JOIN Likes l ON l.post_id=p.post_id
      ${where} GROUP BY p.post_id ORDER BY p.created_at DESC`, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts', async (req, res) => {
  const { user_id, course_id, title, content, topic } = req.body;
  if (!user_id || !course_id || !title?.trim() || !content?.trim()) return badRequest(res, 'user_id, course_id, title and content are required.');
  try {
    const [result] = await sqlPool.execute('INSERT INTO Posts (user_id,course_id,title,content,topic) VALUES (?,?,?,?,?)',
      [Number(user_id), Number(course_id), title.trim(), content.trim(), topic || 'Other']);
    res.status(201).json({ message: 'Post created', post_id: result.insertId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const [rows] = await sqlPool.execute(`SELECT cm.comment_id,cm.content,cm.created_at,u.name AS author
      FROM Comments cm JOIN Users u ON u.user_id=cm.user_id WHERE cm.post_id=? ORDER BY cm.created_at`, [Number(req.params.id)]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/comments', async (req, res) => {
  const { user_id, content } = req.body;
  if (!user_id || !content?.trim()) return badRequest(res, 'user_id and content are required.');
  try {
    const [result] = await sqlPool.execute('INSERT INTO Comments (post_id,user_id,content) VALUES (?,?,?)',
      [Number(req.params.id), Number(user_id), content.trim()]);
    res.status(201).json({ message: 'Comment added', comment_id: result.insertId });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/reviews', async (req, res) => {
  try {
    const filter = {};
    if (req.query.college) filter.college_name = req.query.college;
    const docs = await reviewsCollection.find(filter).sort({ created_at: -1 }).limit(100).toArray();
    res.json(docs.map(d => ({ ...d, _id: d._id.toString() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', async (req, res) => {
  const { college_name, course_name, reviewer_name, category, rating, review_text } = req.body;
  if (![college_name, course_name, reviewer_name, category, review_text].every(v => typeof v === 'string' && v.trim()))
    return badRequest(res, 'All review fields are required.');
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) return badRequest(res, 'rating must be an integer from 1 to 5.');
  try {
    const doc = { college_name: college_name.trim(), course_name: course_name.trim(), reviewer_name: reviewer_name.trim(),
      category: category.trim(), rating: score, review_text: review_text.trim(), created_at: new Date() };
    const result = await reviewsCollection.insertOne(doc);
    res.status(201).json({ message: 'Review saved in MongoDB', review_id: result.insertedId.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/college-posts', async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(`SELECT cl.college_name,COUNT(p.post_id) AS total_posts
      FROM Colleges cl LEFT JOIN Courses c ON c.college_id=cl.college_id
      LEFT JOIN Posts p ON p.course_id=c.course_id GROUP BY cl.college_id,cl.college_name
      ORDER BY total_posts DESC,cl.college_name`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/top-contributors', async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(`SELECT u.user_id,u.name,COUNT(DISTINCT cm.comment_id) AS comments_received,
      COUNT(DISTINCT l.user_id) AS likes_received
      FROM Users u LEFT JOIN Comments cm ON cm.user_id=u.user_id
      LEFT JOIN Likes l ON l.user_id=u.user_id GROUP BY u.user_id,u.name
      ORDER BY likes_received DESC,comments_received DESC LIMIT 10`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/reports/topic-counts', async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(`SELECT topic,COUNT(*) AS total_posts FROM Posts GROUP BY topic ORDER BY total_posts DESC,topic`);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function start() {
  sqlPool = mysql.createPool({ host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '', database: process.env.MYSQL_DATABASE || 'campustalk',
    waitForConnections: true, connectionLimit: 10 });
  mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await mongoClient.connect();
  const mongoDb = mongoClient.db(process.env.MONGODB_DATABASE || 'campustalk');
  reviewsCollection = mongoDb.collection('student_reviews');
  await reviewsCollection.createIndex({ college_name: 1, category: 1 });
  const port = Number(process.env.PORT || 5000);
  app.listen(port, () => console.log(`CampusTalk running at http://localhost:${port}`));
}

start().catch(err => { console.error('Startup failed. Check MySQL/MongoDB services and .env settings.'); console.error(err.message); process.exit(1); });

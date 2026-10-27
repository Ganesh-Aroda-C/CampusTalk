const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app } = require('../server');
const { initDatabases, getSqlPool, getMongoDb } = require('../src/config/db');

let server;
let baseUrl;
let testToken;
let testUser;

before(async () => {
  await initDatabases();
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
  const pool = getSqlPool();
  if (pool) await pool.end();
  const mongo = getMongoDb();
  if (mongo && mongo.client) await mongo.client.close();
});

test('1. Health check returns connected for MySQL and MongoDB', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.server, 'ok');
  assert.equal(data.mysql, 'connected');
  assert.equal(data.mongodb, 'connected');
});

test('2. Discovery endpoints return colleges and courses', async () => {
  const colRes = await fetch(`${baseUrl}/api/colleges`);
  assert.equal(colRes.status, 200);
  const colleges = await colRes.json();
  assert.ok(Array.isArray(colleges));
  assert.ok(colleges.length >= 2);
  assert.ok(colleges[0].college_name);

  const crsRes = await fetch(`${baseUrl}/api/courses`);
  assert.equal(crsRes.status, 200);
  const courses = await crsRes.json();
  assert.ok(Array.isArray(courses));
  assert.ok(courses.length >= 2);
});

test('3. User Registration, Validation & Duplicate Prevention', async () => {
  const uniqueEmail = `test.student.${Date.now()}@campustalk.test`;

  // Validation failure (too short password)
  const badRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'T', email: uniqueEmail, password: '123' })
  });
  assert.equal(badRes.status, 400);

  // Successful registration
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      email: uniqueEmail,
      password: 'password123',
      role: 'current_student',
      academic_year: '3rd Year'
    })
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.ok(regData.token);
  assert.equal(regData.user.name, 'Test Student');
  assert.equal(regData.user.email, uniqueEmail);
  assert.equal(regData.user.password_hash, undefined); // Ensure password_hash is NEVER exposed!

  testToken = regData.token;
  testUser = regData.user;

  // Duplicate email check
  const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Duplicate',
      email: uniqueEmail,
      password: 'password123'
    })
  });
  assert.equal(dupRes.status, 409);
});

test('4. User Login and Profile Retrieval', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUser.email,
      password: 'password123'
    })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.ok(loginData.token);
  assert.equal(loginData.user.email, testUser.email);

  // Authenticated profile retrieval
  const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  assert.equal(profileRes.status, 200);
  const profile = await profileRes.json();
  assert.equal(profile.email, testUser.email);
});

test('5. Discussion CRUD, Filters & Unanswered Questions', async () => {
  // Get all posts
  const postsRes = await fetch(`${baseUrl}/api/posts`);
  assert.equal(postsRes.status, 200);
  const feed = await postsRes.json();
  assert.ok(Array.isArray(feed.posts));
  assert.ok(feed.pagination);

  // Test unanswered questions filter (novel feature)
  const unansweredRes = await fetch(`${baseUrl}/api/posts?unanswered=true`);
  assert.equal(unansweredRes.status, 200);
  const unansweredData = await unansweredRes.json();
  assert.ok(Array.isArray(unansweredData.posts));
  unansweredData.posts.forEach(p => {
    assert.equal(p.comment_count, 0, 'Every post in unanswered filter must have 0 comments');
  });

  // Create a new post
  const coursesRes = await fetch(`${baseUrl}/api/courses`);
  const courses = await coursesRes.json();
  const testCourseId = courses[0].course_id;

  const newPostRes = await fetch(`${baseUrl}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({
      course_id: testCourseId,
      title: 'Automated Test Discussion Title',
      content: 'This is test content written during the automated verification test run.',
      topic: 'Academics'
    })
  });
  assert.equal(newPostRes.status, 201);
  const newPostData = await newPostRes.json();
  assert.ok(newPostData.post_id);
  const createdPostId = newPostData.post_id;

  // Edit own post
  const editRes = await fetch(`${baseUrl}/api/posts/${createdPostId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({
      title: 'Updated Automated Test Discussion Title'
    })
  });
  assert.equal(editRes.status, 200);

  // Delete own post
  const delRes = await fetch(`${baseUrl}/api/posts/${createdPostId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  assert.equal(delRes.status, 200);
});

test('6. Comments and Likes with Duplicate Prevention', async () => {
  const postsRes = await fetch(`${baseUrl}/api/posts`);
  const feed = await postsRes.json();
  const samplePost = feed.posts[0];
  assert.ok(samplePost, 'Need at least one seeded post');

  // Add comment
  const commentRes = await fetch(`${baseUrl}/api/posts/${samplePost.post_id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({ content: 'Test automated comment reply.' })
  });
  assert.equal(commentRes.status, 201);
  const commentData = await commentRes.json();
  assert.ok(commentData.comment_id);

  // Toggle like ON
  const likeOnRes = await fetch(`${baseUrl}/api/posts/${samplePost.post_id}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  assert.equal(likeOnRes.status, 200);
  const likeOnData = await likeOnRes.json();
  assert.equal(typeof likeOnData.liked, 'boolean');

  // Toggle like OFF
  const likeOffRes = await fetch(`${baseUrl}/api/posts/${samplePost.post_id}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  assert.equal(likeOffRes.status, 200);
  const likeOffData = await likeOffRes.json();
  assert.equal(likeOffData.liked, !likeOnData.liked);

  // Cleanup test comment
  await fetch(`${baseUrl}/api/comments/${commentData.comment_id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
});

test('7. MongoDB Student Reviews and Aggregations', async () => {
  // Get reviews
  const revRes = await fetch(`${baseUrl}/api/reviews`);
  assert.equal(revRes.status, 200);
  const revData = await revRes.json();
  assert.ok(Array.isArray(revData.reviews));

  // Create review
  const newRevRes = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testToken}`
    },
    body: JSON.stringify({
      college_name: 'PES University',
      course_name: 'B.Tech Computer Science and Engineering',
      category: 'Academics',
      rating: 5,
      review_text: 'Detailed test review for automated verification test suite.',
      pros: 'Excellent computing labs',
      cons: 'Heavy weekly ISAs'
    })
  });
  assert.equal(newRevRes.status, 201);
  const newRevData = await newRevRes.json();
  assert.ok(newRevData.review_id);

  // Test MongoDB aggregation summary
  const summaryRes = await fetch(`${baseUrl}/api/reviews-summary`);
  assert.equal(summaryRes.status, 200);
  const summary = await summaryRes.json();
  assert.ok(summary.overall);
  assert.ok(summary.overall.total_reviews >= 1);
  assert.ok(Array.isArray(summary.categories));

  // Delete own review
  const delRevRes = await fetch(`${baseUrl}/api/reviews/${newRevData.review_id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${testToken}` }
  });
  assert.equal(delRevRes.status, 200);
});

test('8. DBMS Reports Execution and CSV Export', async () => {
  const r1 = await fetch(`${baseUrl}/api/reports/college-posts`);
  assert.equal(r1.status, 200);
  const r1Data = await r1.json();
  assert.ok(Array.isArray(r1Data));

  const r2 = await fetch(`${baseUrl}/api/reports/course-activity`);
  assert.equal(r2.status, 200);

  const r3 = await fetch(`${baseUrl}/api/reports/topic-counts`);
  assert.equal(r3.status, 200);

  const r4 = await fetch(`${baseUrl}/api/reports/useful-discussions`);
  assert.equal(r4.status, 200);

  const r5 = await fetch(`${baseUrl}/api/reports/average-ratings`);
  assert.equal(r5.status, 200);

  const r6 = await fetch(`${baseUrl}/api/reports/reviews-by-category`);
  assert.equal(r6.status, 200);

  const r7 = await fetch(`${baseUrl}/api/reports/monthly-activity`);
  assert.equal(r7.status, 200);

  // CSV Export test
  const csvRes = await fetch(`${baseUrl}/api/reports/export/college-posts`);
  assert.equal(csvRes.status, 200);
  assert.match(csvRes.headers.get('content-type'), /text\/csv/);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('college_name'));
});

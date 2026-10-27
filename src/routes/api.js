const express = require('express');
const router = express.Router();

const { authenticateToken, optionalAuth, rateLimit } = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const postCtrl = require('../controllers/postController');
const commentCtrl = require('../controllers/commentController');
const likeCtrl = require('../controllers/likeController');
const discoveryCtrl = require('../controllers/discoveryController');
const reviewCtrl = require('../controllers/reviewController');
const reportCtrl = require('../controllers/reportController');
const { getDatabaseStatus, getSqlPool } = require('../config/db');

// Health check
router.get('/health', async (_req, res) => {
  const status = await getDatabaseStatus();
  res.json(status);
});

// Authentication routes
router.post('/auth/register', rateLimit(20, 60000), authCtrl.register);
router.post('/auth/login', rateLimit(30, 60000), authCtrl.login);
router.get('/auth/me', authenticateToken, authCtrl.getProfile);
router.put('/auth/profile', authenticateToken, authCtrl.updateProfile);

// Discovery routes (Colleges & Courses)
router.get('/colleges', discoveryCtrl.getColleges);
router.get('/colleges/:id', discoveryCtrl.getCollegeById);
router.get('/courses', discoveryCtrl.getCourses);

// Topics reference list
router.get('/topics', async (_req, res) => {
  const pool = getSqlPool();
  try {
    const [rows] = await pool.query('SELECT topic_id, topic_name, description, icon FROM Topics ORDER BY topic_id ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Discussion Feed (Posts)
router.get('/posts', optionalAuth, postCtrl.getPosts);
router.get('/posts/:id', optionalAuth, postCtrl.getPostById);
router.post('/posts', authenticateToken, postCtrl.createPost);
router.put('/posts/:id', authenticateToken, postCtrl.updatePost);
router.delete('/posts/:id', authenticateToken, postCtrl.deletePost);

// Comments
router.get('/posts/:id/comments', optionalAuth, commentCtrl.getComments);
router.post('/posts/:id/comments', authenticateToken, commentCtrl.createComment);
router.delete('/comments/:id', authenticateToken, commentCtrl.deleteComment);

// Likes
router.post('/posts/:id/like', authenticateToken, likeCtrl.toggleLike);

// Student Reviews (MongoDB)
router.get('/reviews', optionalAuth, reviewCtrl.getReviews);
router.post('/reviews', authenticateToken, reviewCtrl.createReview);
router.delete('/reviews/:id', authenticateToken, reviewCtrl.deleteReview);
router.get('/reviews-summary', reviewCtrl.getReviewSummary);

// DBMS Reports
router.get('/reports/college-posts', reportCtrl.getCollegePostsReport);
router.get('/reports/course-activity', reportCtrl.getCourseActivityReport);
router.get('/reports/topic-counts', reportCtrl.getTopicCountsReport);
router.get('/reports/useful-discussions', reportCtrl.getUsefulDiscussionsReport);
router.get('/reports/average-ratings', reportCtrl.getAverageRatingsReport);
router.get('/reports/reviews-by-category', reportCtrl.getReviewsByCategoryReport);
router.get('/reports/monthly-activity', reportCtrl.getMonthlyActivityReport);
router.get('/reports/export/:type', reportCtrl.exportReportCsv);

module.exports = router;

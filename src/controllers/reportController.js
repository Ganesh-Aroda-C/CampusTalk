const { getSqlPool, getReviewsCollection } = require('../config/db');

// Report 1: College-wise discussion activity
async function getCollegePostsReport(_req, res) {
  const pool = getSqlPool();
  try {
    const [rows] = await pool.query(`
      SELECT cl.college_id, cl.college_name, cl.location,
             COUNT(DISTINCT c.course_id) AS total_courses,
             COUNT(DISTINCT p.post_id) AS total_posts,
             COUNT(DISTINCT cm.comment_id) AS total_comments,
             COUNT(DISTINCT l.like_id) AS total_likes
      FROM Colleges cl
      LEFT JOIN Courses c ON c.college_id = cl.college_id
      LEFT JOIN Posts p ON p.course_id = c.course_id
      LEFT JOIN Comments cm ON cm.post_id = p.post_id
      LEFT JOIN Likes l ON l.post_id = p.post_id
      GROUP BY cl.college_id, cl.college_name, cl.location
      ORDER BY total_posts DESC, total_comments DESC, cl.college_name ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('getCollegePostsReport error:', err);
    return res.status(500).json({ error: 'Failed to generate college discussion report.' });
  }
}

// Report 2: Course-wise discussion activity
async function getCourseActivityReport(_req, res) {
  const pool = getSqlPool();
  try {
    const [rows] = await pool.query(`
      SELECT c.course_id, c.course_name, c.degree_level,
             cl.college_name,
             COUNT(DISTINCT p.post_id) AS total_posts,
             COUNT(DISTINCT cm.comment_id) AS total_comments,
             COUNT(DISTINCT l.like_id) AS total_likes
      FROM Courses c
      JOIN Colleges cl ON cl.college_id = c.college_id
      LEFT JOIN Posts p ON p.course_id = c.course_id
      LEFT JOIN Comments cm ON cm.post_id = p.post_id
      LEFT JOIN Likes l ON l.post_id = p.post_id
      GROUP BY c.course_id, c.course_name, c.degree_level, cl.college_name
      ORDER BY total_posts DESC, total_comments DESC, c.course_name ASC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('getCourseActivityReport error:', err);
    return res.status(500).json({ error: 'Failed to generate course activity report.' });
  }
}

// Report 3: Most discussed topics
async function getTopicCountsReport(_req, res) {
  const pool = getSqlPool();
  try {
    const [rows] = await pool.query(`
      SELECT p.topic,
             COUNT(p.post_id) AS total_posts,
             ROUND(COUNT(p.post_id) * 100.0 / (SELECT NULLIF(COUNT(*), 0) FROM Posts), 1) AS percentage,
             COUNT(DISTINCT cm.comment_id) AS total_comments,
             COUNT(DISTINCT l.like_id) AS total_likes
      FROM Posts p
      LEFT JOIN Comments cm ON cm.post_id = p.post_id
      LEFT JOIN Likes l ON l.post_id = p.post_id
      GROUP BY p.topic
      ORDER BY total_posts DESC, total_comments DESC
    `);
    return res.json(rows);
  } catch (err) {
    console.error('getTopicCountsReport error:', err);
    return res.status(500).json({ error: 'Failed to generate topic counts report.' });
  }
}

// Report 4: Most useful discussions (based on like & comment counts)
async function getUsefulDiscussionsReport(req, res) {
  const pool = getSqlPool();
  const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 10));

  try {
    const [rows] = await pool.query(`
      SELECT p.post_id, p.title, p.topic, p.created_at,
             u.name AS author_name, u.role AS author_role,
             cl.college_name, c.course_name,
             COUNT(DISTINCT cm.comment_id) AS total_comments,
             COUNT(DISTINCT l.like_id) AS total_likes,
             (COUNT(DISTINCT l.like_id) * 2 + COUNT(DISTINCT cm.comment_id) * 3) AS usefulness_score
      FROM Posts p
      JOIN Users u ON u.user_id = p.user_id
      JOIN Courses c ON c.course_id = p.course_id
      JOIN Colleges cl ON cl.college_id = c.college_id
      LEFT JOIN Comments cm ON cm.post_id = p.post_id
      LEFT JOIN Likes l ON l.post_id = p.post_id
      GROUP BY p.post_id, p.title, p.topic, p.created_at, u.name, u.role, cl.college_name, c.course_name
      ORDER BY usefulness_score DESC, total_comments DESC, p.created_at DESC
      LIMIT ?
    `, [limit]);
    return res.json(rows);
  } catch (err) {
    console.error('getUsefulDiscussionsReport error:', err);
    return res.status(500).json({ error: 'Failed to generate useful discussions report.' });
  }
}

// Report 5: Average review rating by college and course (MongoDB aggregation)
async function getAverageRatingsReport(_req, res) {
  const reviewsColl = getReviewsCollection();
  try {
    const results = await reviewsColl.aggregate([
      {
        $group: {
          _id: { college: '$college_name', course: '$course_name' },
          avg_rating: { $avg: '$rating' },
          min_rating: { $min: '$rating' },
          max_rating: { $max: '$rating' },
          total_reviews: { $sum: 1 }
        }
      },
      {
        $project: {
          college_name: '$_id.college',
          course_name: '$_id.course',
          avg_rating: { $round: ['$avg_rating', 2] },
          min_rating: 1,
          max_rating: 1,
          total_reviews: 1,
          _id: 0
        }
      },
      { $sort: { avg_rating: -1, total_reviews: -1 } }
    ]).toArray();

    return res.json(results);
  } catch (err) {
    console.error('getAverageRatingsReport error:', err);
    return res.status(500).json({ error: 'Failed to generate ratings aggregation report.' });
  }
}

// Report 6: Review counts by college, course and topic/category (MongoDB aggregation)
async function getReviewsByCategoryReport(_req, res) {
  const reviewsColl = getReviewsCollection();
  try {
    const results = await reviewsColl.aggregate([
      {
        $group: {
          _id: { college: '$college_name', category: '$category' },
          total_reviews: { $sum: 1 },
          avg_rating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          college_name: '$_id.college',
          category: '$_id.category',
          total_reviews: 1,
          avg_rating: { $round: ['$avg_rating', 2] },
          _id: 0
        }
      },
      { $sort: { college_name: 1, total_reviews: -1 } }
    ]).toArray();

    return res.json(results);
  } catch (err) {
    console.error('getReviewsByCategoryReport error:', err);
    return res.status(500).json({ error: 'Failed to generate reviews by category report.' });
  }
}

// Report 7: Monthly discussion and review activity (MySQL + MongoDB time-series)
async function getMonthlyActivityReport(_req, res) {
  const pool = getSqlPool();
  const reviewsColl = getReviewsCollection();

  try {
    // 1. MySQL monthly post counts
    const [sqlRows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
             COUNT(post_id) AS posts_count,
             COUNT(DISTINCT user_id) AS active_authors
      FROM Posts
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // 2. MongoDB monthly review counts
    let mongoRows = [];
    try {
      mongoRows = await reviewsColl.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$created_at' } },
            reviews_count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();
    } catch (e) {
      console.warn('MongoDB monthly aggregation warning:', e.message);
    }

    const reviewMonthMap = {};
    mongoRows.forEach(m => { reviewMonthMap[m._id] = m.reviews_count; });

    // Combine monthly timeline
    const allMonths = new Set([...sqlRows.map(r => r.month), ...mongoRows.map(m => m._id)]);
    const timeline = Array.from(allMonths).sort().map(month => {
      const sqlRecord = sqlRows.find(r => r.month === month) || { posts_count: 0, active_authors: 0 };
      return {
        month,
        posts_count: sqlRecord.posts_count,
        active_authors: sqlRecord.active_authors,
        reviews_count: reviewMonthMap[month] || 0
      };
    });

    return res.json(timeline);
  } catch (err) {
    console.error('getMonthlyActivityReport error:', err);
    return res.status(500).json({ error: 'Failed to generate monthly activity report.' });
  }
}

// CSV Export Endpoint
async function exportReportCsv(req, res) {
  const { type } = req.params;

  try {
    let rows = [];
    let filename = `campustalk_report_${type}.csv`;

    if (type === 'college-posts') {
      const pool = getSqlPool();
      const [data] = await pool.query(`
        SELECT cl.college_name, cl.location,
               COUNT(DISTINCT c.course_id) AS total_courses,
               COUNT(DISTINCT p.post_id) AS total_posts,
               COUNT(DISTINCT cm.comment_id) AS total_comments,
               COUNT(DISTINCT l.like_id) AS total_likes
        FROM Colleges cl
        LEFT JOIN Courses c ON c.college_id = cl.college_id
        LEFT JOIN Posts p ON p.course_id = c.course_id
        LEFT JOIN Comments cm ON cm.post_id = p.post_id
        LEFT JOIN Likes l ON l.post_id = p.post_id
        GROUP BY cl.college_id, cl.college_name, cl.location
        ORDER BY total_posts DESC
      `);
      rows = data;
    } else if (type === 'course-activity') {
      const pool = getSqlPool();
      const [data] = await pool.query(`
        SELECT cl.college_name, c.course_name, c.degree_level,
               COUNT(DISTINCT p.post_id) AS total_posts,
               COUNT(DISTINCT cm.comment_id) AS total_comments,
               COUNT(DISTINCT l.like_id) AS total_likes
        FROM Courses c
        JOIN Colleges cl ON cl.college_id = c.college_id
        LEFT JOIN Posts p ON p.course_id = c.course_id
        LEFT JOIN Comments cm ON cm.post_id = p.post_id
        LEFT JOIN Likes l ON l.post_id = p.post_id
        GROUP BY c.course_id, c.course_name, c.degree_level, cl.college_name
        ORDER BY total_posts DESC
      `);
      rows = data;
    } else if (type === 'topic-counts') {
      const pool = getSqlPool();
      const [data] = await pool.query(`
        SELECT p.topic, COUNT(p.post_id) AS total_posts,
               COUNT(DISTINCT cm.comment_id) AS total_comments,
               COUNT(DISTINCT l.like_id) AS total_likes
        FROM Posts p
        LEFT JOIN Comments cm ON cm.post_id = p.post_id
        LEFT JOIN Likes l ON l.post_id = p.post_id
        GROUP BY p.topic ORDER BY total_posts DESC
      `);
      rows = data;
    } else if (type === 'average-ratings') {
      const reviewsColl = getReviewsCollection();
      rows = await reviewsColl.aggregate([
        {
          $group: {
            _id: { college: '$college_name', course: '$course_name' },
            avg_rating: { $avg: '$rating' },
            total_reviews: { $sum: 1 }
          }
        },
        {
          $project: {
            college_name: '$_id.college',
            course_name: '$_id.course',
            avg_rating: { $round: ['$avg_rating', 2] },
            total_reviews: 1,
            _id: 0
          }
        },
        { $sort: { avg_rating: -1 } }
      ]).toArray();
    } else {
      return res.status(400).json({ error: 'Unknown report export type.' });
    }

    if (rows.length === 0) {
      return res.status(404).send('No report data found to export.');
    }

    // Convert to CSV
    const headers = Object.keys(rows[0]);
    const csvLines = [headers.join(',')];
    rows.forEach(r => {
      const values = headers.map(h => {
        const val = r[h] !== null && r[h] !== undefined ? String(r[h]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvLines.push(values.join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvLines.join('\n'));
  } catch (err) {
    console.error('exportReportCsv error:', err);
    return res.status(500).json({ error: 'Failed to export CSV.' });
  }
}

module.exports = {
  getCollegePostsReport,
  getCourseActivityReport,
  getTopicCountsReport,
  getUsefulDiscussionsReport,
  getAverageRatingsReport,
  getReviewsByCategoryReport,
  getMonthlyActivityReport,
  exportReportCsv
};

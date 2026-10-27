const { getSqlPool, getReviewsCollection } = require('../config/db');

async function getColleges(_req, res) {
  const pool = getSqlPool();
  const reviewsColl = getReviewsCollection();

  try {
    // 1. Fetch colleges with relational post and course counts
    const [rows] = await pool.query(`
      SELECT cl.college_id, cl.college_name, cl.location, cl.state, cl.established_year, cl.website,
             COUNT(DISTINCT c.course_id) AS course_count,
             COUNT(DISTINCT p.post_id) AS post_count
      FROM Colleges cl
      LEFT JOIN Courses c ON c.college_id = cl.college_id
      LEFT JOIN Posts p ON p.course_id = c.course_id
      GROUP BY cl.college_id
      ORDER BY cl.college_name ASC
    `);

    // 2. Fetch review aggregates from MongoDB
    let reviewStats = [];
    try {
      reviewStats = await reviewsColl.aggregate([
        {
          $group: {
            _id: '$college_name',
            avg_rating: { $avg: '$rating' },
            review_count: { $sum: 1 }
          }
        }
      ]).toArray();
    } catch (e) {
      console.warn('MongoDB review aggregation warning in getColleges:', e.message);
    }

    const reviewMap = {};
    reviewStats.forEach(r => {
      reviewMap[r._id] = {
        avg_rating: r.avg_rating ? Number(r.avg_rating.toFixed(1)) : null,
        review_count: r.review_count || 0
      };
    });

    // Merge data
    const enrichedColleges = rows.map(cl => ({
      ...cl,
      avg_rating: reviewMap[cl.college_name]?.avg_rating || null,
      review_count: reviewMap[cl.college_name]?.review_count || 0
    }));

    return res.json(enrichedColleges);
  } catch (err) {
    console.error('getColleges error:', err);
    return res.status(500).json({ error: 'Failed to retrieve colleges directory.' });
  }
}

async function getCollegeById(req, res) {
  const collegeId = Number(req.params.id);

  if (!collegeId || isNaN(collegeId)) {
    return res.status(400).json({ error: 'Invalid college ID.' });
  }

  const pool = getSqlPool();
  const reviewsColl = getReviewsCollection();

  try {
    const [collegeRows] = await pool.execute(
      `SELECT cl.college_id, cl.college_name, cl.location, cl.state, cl.established_year, cl.website,
              COUNT(DISTINCT c.course_id) AS course_count,
              COUNT(DISTINCT p.post_id) AS post_count
       FROM Colleges cl
       LEFT JOIN Courses c ON c.college_id = cl.college_id
       LEFT JOIN Posts p ON p.course_id = c.course_id
       WHERE cl.college_id = ?
       GROUP BY cl.college_id`,
      [collegeId]
    );

    if (collegeRows.length === 0) {
      return res.status(404).json({ error: 'College not found.' });
    }

    const college = collegeRows[0];

    // Fetch courses for this college
    const [courses] = await pool.execute(
      `SELECT c.course_id, c.course_name, c.degree_level, c.duration_years,
              COUNT(p.post_id) AS post_count
       FROM Courses c
       LEFT JOIN Posts p ON p.course_id = c.course_id
       WHERE c.college_id = ?
       GROUP BY c.course_id
       ORDER BY c.course_name`,
      [collegeId]
    );

    // Fetch MongoDB reviews for this college
    let reviews = [];
    let reviewSummary = { avg_rating: null, total_reviews: 0, category_ratings: [] };
    try {
      reviews = await reviewsColl.find({ college_name: college.college_name }).sort({ created_at: -1 }).limit(10).toArray();

      const summaryAgg = await reviewsColl.aggregate([
        { $match: { college_name: college.college_name } },
        {
          $group: {
            _id: '$category',
            avg_rating: { $avg: '$rating' },
            count: { $sum: 1 }
          }
        }
      ]).toArray();

      if (reviews.length > 0) {
        const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
        reviewSummary.avg_rating = Number((totalRating / reviews.length).toFixed(1));
        reviewSummary.total_reviews = reviews.length;
        reviewSummary.category_ratings = summaryAgg.map(s => ({
          category: s._id,
          avg_rating: Number(s.avg_rating.toFixed(1)),
          count: s.count
        }));
      }
    } catch (e) {
      console.warn('MongoDB query warning in getCollegeById:', e.message);
    }

    return res.json({
      ...college,
      courses,
      reviews: reviews.map(r => ({ ...r, _id: r._id.toString() })),
      review_summary: reviewSummary
    });
  } catch (err) {
    console.error('getCollegeById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve college details.' });
  }
}

async function getCourses(req, res) {
  const pool = getSqlPool();

  try {
    const params = [];
    let whereClause = '';

    if (req.query.college_id) {
      whereClause = 'WHERE c.college_id = ?';
      params.push(Number(req.query.college_id));
    }

    const [rows] = await pool.query(
      `SELECT c.course_id, c.course_name, c.degree_level, c.duration_years,
              cl.college_id, cl.college_name, cl.location,
              COUNT(p.post_id) AS post_count
       FROM Courses c
       JOIN Colleges cl ON cl.college_id = c.college_id
       LEFT JOIN Posts p ON p.course_id = c.course_id
       ${whereClause}
       GROUP BY c.course_id
       ORDER BY cl.college_name ASC, c.course_name ASC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    console.error('getCourses error:', err);
    return res.status(500).json({ error: 'Failed to retrieve courses.' });
  }
}

async function globalSearch(req, res) {
  const q = req.query.q ? String(req.query.q).trim() : '';
  if (!q) {
    return res.json({ colleges: [], courses: [], posts: [], reviews: [] });
  }

  const pool = getSqlPool();
  const reviewsColl = getReviewsCollection();

  try {
    const likePattern = `%${q}%`;

    const [colleges] = await pool.query(
      `SELECT cl.college_id, cl.college_name, cl.location, cl.state,
              COUNT(DISTINCT p.post_id) AS post_count
       FROM Colleges cl
       LEFT JOIN Courses c ON c.college_id = cl.college_id
       LEFT JOIN Posts p ON p.course_id = c.course_id
       WHERE cl.college_name LIKE ? OR cl.location LIKE ? OR cl.state LIKE ?
       GROUP BY cl.college_id
       LIMIT 6`,
      [likePattern, likePattern, likePattern]
    );

    const [courses] = await pool.query(
      `SELECT c.course_id, c.course_name, c.degree_level, cl.college_id, cl.college_name
       FROM Courses c
       JOIN Colleges cl ON cl.college_id = c.college_id
       WHERE c.course_name LIKE ?
       LIMIT 6`,
      [likePattern]
    );

    const [posts] = await pool.query(
      `SELECT p.post_id, p.title, p.content, p.topic, p.created_at,
              u.name AS author, cl.college_name, c.course_name,
              COUNT(DISTINCT cm.comment_id) AS comment_count,
              COUNT(DISTINCT l.like_id) AS like_count
       FROM Posts p
       JOIN Users u ON u.user_id = p.user_id
       JOIN Courses c ON c.course_id = p.course_id
       JOIN Colleges cl ON cl.college_id = c.college_id
       LEFT JOIN Comments cm ON cm.post_id = p.post_id
       LEFT JOIN Likes l ON l.post_id = p.post_id
       WHERE p.title LIKE ? OR p.content LIKE ? OR p.topic LIKE ?
       GROUP BY p.post_id
       ORDER BY p.created_at DESC
       LIMIT 6`,
      [likePattern, likePattern, likePattern]
    );

    let reviews = [];
    try {
      reviews = await reviewsColl
        .find({
          $or: [
            { college_name: { $regex: q, $options: 'i' } },
            { course_name: { $regex: q, $options: 'i' } },
            { review_text: { $regex: q, $options: 'i' } },
            { category: { $regex: q, $options: 'i' } }
          ]
        })
        .limit(6)
        .toArray();
    } catch (e) {
      console.warn('MongoDB search warning:', e.message);
    }

    return res.json({
      colleges,
      courses,
      posts,
      reviews: reviews.map(r => ({ ...r, _id: r._id.toString() }))
    });
  } catch (err) {
    console.error('globalSearch error:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
}

module.exports = {
  getColleges,
  getCollegeById,
  getCourses,
  globalSearch
};

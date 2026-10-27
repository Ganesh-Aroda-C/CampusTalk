const { getSqlPool } = require('../config/db');

const VALID_TOPICS = [
  'Academics',
  'Placements',
  'Hostels',
  'Campus Life',
  'Clubs',
  'Admissions',
  'Faculty',
  'Fees & ROI',
  'Other'
];

async function getPosts(req, res) {
  const pool = getSqlPool();

  try {
    const { college_id, course_id, topic, q, unanswered, sort, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const filters = [];
    const params = [];

    if (college_id) {
      filters.push('cl.college_id = ?');
      params.push(Number(college_id));
    }

    if (course_id) {
      filters.push('c.course_id = ?');
      params.push(Number(course_id));
    }

    if (topic && VALID_TOPICS.includes(topic)) {
      filters.push('p.topic = ?');
      params.push(topic);
    }

    if (q && q.trim()) {
      filters.push('(p.title LIKE ? OR p.content LIKE ?)');
      params.push(`%${q.trim()}%`, `%${q.trim()}%`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    let havingClause = '';
    if (unanswered === 'true') {
      havingClause = 'HAVING comment_count = 0';
    }

    // Determine sorting
    let orderBy = 'p.created_at DESC';
    if (sort === 'popular') {
      orderBy = '(COUNT(DISTINCT l.like_id) * 2 + COUNT(DISTINCT cm.comment_id) * 3) DESC, p.created_at DESC';
    } else if (sort === 'unanswered' || unanswered === 'true') {
      orderBy = 'comment_count ASC, p.created_at DESC';
    } else if (sort === 'likes') {
      orderBy = 'like_count DESC, p.created_at DESC';
    }

    // Main query
    const currentUserId = req.user ? req.user.user_id : 0;

    const querySql = `
      SELECT p.post_id, p.title, p.content, p.topic, p.academic_year, p.view_count, p.created_at, p.updated_at,
             u.user_id AS author_id, u.name AS author, u.role AS author_role, u.academic_year AS author_year,
             c.course_id, c.course_name,
             cl.college_id, cl.college_name, cl.location AS college_location,
             COUNT(DISTINCT cm.comment_id) AS comment_count,
             COUNT(DISTINCT l.like_id) AS like_count,
             EXISTS(SELECT 1 FROM Likes ul WHERE ul.post_id = p.post_id AND ul.user_id = ?) AS user_has_liked
      FROM Posts p
      JOIN Users u ON u.user_id = p.user_id
      JOIN Courses c ON c.course_id = p.course_id
      JOIN Colleges cl ON cl.college_id = c.college_id
      LEFT JOIN Comments cm ON cm.post_id = p.post_id
      LEFT JOIN Likes l ON l.post_id = p.post_id
      ${whereClause}
      GROUP BY p.post_id
      ${havingClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const queryParams = [currentUserId, ...params, limitNum, offset];
    const [rows] = await pool.query(querySql, queryParams);

    // Count query for pagination
    let countSql;
    let countParams;

    if (unanswered === 'true') {
      countSql = `
        SELECT COUNT(*) AS total FROM (
          SELECT p.post_id
          FROM Posts p
          JOIN Courses c ON c.course_id = p.course_id
          JOIN Colleges cl ON cl.college_id = c.college_id
          LEFT JOIN Comments cm ON cm.post_id = p.post_id
          ${whereClause}
          GROUP BY p.post_id
          HAVING COUNT(cm.comment_id) = 0
        ) AS sub
      `;
      countParams = params;
    } else {
      countSql = `
        SELECT COUNT(DISTINCT p.post_id) AS total
        FROM Posts p
        JOIN Courses c ON c.course_id = p.course_id
        JOIN Colleges cl ON cl.college_id = c.college_id
        ${whereClause}
      `;
      countParams = params;
    }

    const [countResult] = await pool.query(countSql, countParams);
    const totalPosts = countResult.length > 0 ? (countResult[0].total || 0) : 0;
    const totalPages = Math.ceil(totalPosts / limitNum) || 1;

    // Attach is_author flag
    const postsWithFlags = rows.map(r => ({
      ...r,
      user_has_liked: Boolean(r.user_has_liked),
      is_author: req.user ? req.user.user_id === r.author_id : false
    }));

    return res.json({
      posts: postsWithFlags,
      pagination: {
        total: totalPosts,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    });
  } catch (err) {
    console.error('getPosts error:', err);
    return res.status(500).json({ error: 'Failed to retrieve discussions.' });
  }
}

async function getPostById(req, res) {
  const pool = getSqlPool();
  const postId = Number(req.params.id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  try {
    // Increment view count asynchronously
    pool.execute('UPDATE Posts SET view_count = view_count + 1 WHERE post_id = ?', [postId]).catch(() => {});

    const currentUserId = req.user ? req.user.user_id : 0;

    const [rows] = await pool.query(
      `SELECT p.post_id, p.title, p.content, p.topic, p.academic_year, p.view_count, p.created_at, p.updated_at,
              u.user_id AS author_id, u.name AS author, u.role AS author_role, u.academic_year AS author_year,
              c.course_id, c.course_name,
              cl.college_id, cl.college_name, cl.location AS college_location,
              COUNT(DISTINCT cm.comment_id) AS comment_count,
              COUNT(DISTINCT l.like_id) AS like_count,
              EXISTS(SELECT 1 FROM Likes ul WHERE ul.post_id = p.post_id AND ul.user_id = ?) AS user_has_liked
       FROM Posts p
       JOIN Users u ON u.user_id = p.user_id
       JOIN Courses c ON c.course_id = p.course_id
       JOIN Colleges cl ON cl.college_id = c.college_id
       LEFT JOIN Comments cm ON cm.post_id = p.post_id
       LEFT JOIN Likes l ON l.post_id = p.post_id
       WHERE p.post_id = ?
       GROUP BY p.post_id`,
      [currentUserId, postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    const post = rows[0];
    post.user_has_liked = Boolean(post.user_has_liked);
    post.is_author = req.user ? req.user.user_id === post.author_id : false;

    return res.json(post);
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ error: 'Failed to retrieve discussion.' });
  }
}

async function createPost(req, res) {
  const { course_id, title, content, topic, academic_year } = req.body;

  if (!course_id || isNaN(Number(course_id))) {
    return res.status(400).json({ error: 'A valid college course must be selected.' });
  }

  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 200) {
    return res.status(400).json({ error: 'Title must be between 3 and 200 characters.' });
  }

  if (!content || typeof content !== 'string' || content.trim().length < 5 || content.trim().length > 5000) {
    return res.status(400).json({ error: 'Content details must be between 5 and 5000 characters.' });
  }

  const selectedTopic = VALID_TOPICS.includes(topic) ? topic : 'Other';
  const pool = getSqlPool();

  try {
    // Verify course exists
    const [courses] = await pool.execute('SELECT course_id FROM Courses WHERE course_id = ?', [Number(course_id)]);
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Selected course does not exist.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO Posts (user_id, course_id, title, content, topic, academic_year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        Number(course_id),
        title.trim(),
        content.trim(),
        selectedTopic,
        academic_year ? String(academic_year).trim() : null
      ]
    );

    return res.status(201).json({
      message: 'Discussion published successfully',
      post_id: result.insertId
    });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ error: 'Failed to publish discussion.' });
  }
}

async function updatePost(req, res) {
  const postId = Number(req.params.id);
  const { title, content, topic, academic_year } = req.body;

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  const pool = getSqlPool();

  try {
    const [existing] = await pool.execute('SELECT user_id FROM Posts WHERE post_id = ?', [postId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    // Ownership check: must be author or admin
    if (existing[0].user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to edit this discussion.' });
    }

    const updates = [];
    const params = [];

    if (title && typeof title === 'string' && title.trim().length >= 3) {
      updates.push('title = ?');
      params.push(title.trim());
    }

    if (content && typeof content === 'string' && content.trim().length >= 5) {
      updates.push('content = ?');
      params.push(content.trim());
    }

    if (topic && VALID_TOPICS.includes(topic)) {
      updates.push('topic = ?');
      params.push(topic);
    }

    if (academic_year !== undefined) {
      updates.push('academic_year = ?');
      params.push(academic_year ? String(academic_year).trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    params.push(postId);
    await pool.execute(`UPDATE Posts SET ${updates.join(', ')} WHERE post_id = ?`, params);

    return res.json({ message: 'Discussion updated successfully' });
  } catch (err) {
    console.error('updatePost error:', err);
    return res.status(500).json({ error: 'Failed to update discussion.' });
  }
}

async function deletePost(req, res) {
  const postId = Number(req.params.id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  const pool = getSqlPool();

  try {
    const [existing] = await pool.execute('SELECT user_id FROM Posts WHERE post_id = ?', [postId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    // Ownership check
    if (existing[0].user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this discussion.' });
    }

    await pool.execute('DELETE FROM Posts WHERE post_id = ?', [postId]);

    return res.json({ message: 'Discussion deleted successfully' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ error: 'Failed to delete discussion.' });
  }
}

module.exports = {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost
};

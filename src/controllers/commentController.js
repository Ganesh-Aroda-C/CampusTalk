const { getSqlPool } = require('../config/db');

async function getComments(req, res) {
  const postId = Number(req.params.id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  const pool = getSqlPool();

  try {
    const [rows] = await pool.execute(
      `SELECT cm.comment_id, cm.post_id, cm.content, cm.created_at, cm.updated_at,
              u.user_id AS author_id, u.name AS author, u.role AS author_role, u.academic_year AS author_year
       FROM Comments cm
       JOIN Users u ON u.user_id = cm.user_id
       WHERE cm.post_id = ?
       ORDER BY cm.created_at ASC`,
      [postId]
    );

    const commentsWithFlags = rows.map(c => ({
      ...c,
      is_author: req.user ? req.user.user_id === c.author_id : false
    }));

    return res.json(commentsWithFlags);
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ error: 'Failed to retrieve comments.' });
  }
}

async function createComment(req, res) {
  const postId = Number(req.params.id);
  const { content } = req.body;

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0 || content.trim().length > 1000) {
    return res.status(400).json({ error: 'Comment must be between 1 and 1000 characters.' });
  }

  const pool = getSqlPool();

  try {
    // Verify post exists
    const [posts] = await pool.execute('SELECT post_id FROM Posts WHERE post_id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    const [result] = await pool.execute(
      'INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [postId, req.user.user_id, content.trim()]
    );

    return res.status(201).json({
      message: 'Comment added successfully',
      comment_id: result.insertId
    });
  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
}

async function deleteComment(req, res) {
  const commentId = Number(req.params.id);

  if (!commentId || isNaN(commentId)) {
    return res.status(400).json({ error: 'Invalid comment ID.' });
  }

  const pool = getSqlPool();

  try {
    const [existing] = await pool.execute('SELECT user_id FROM Comments WHERE comment_id = ?', [commentId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    if (existing[0].user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this comment.' });
    }

    await pool.execute('DELETE FROM Comments WHERE comment_id = ?', [commentId]);

    return res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
}

module.exports = {
  getComments,
  createComment,
  deleteComment
};

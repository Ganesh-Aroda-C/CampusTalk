const { getSqlPool } = require('../config/db');

async function toggleLike(req, res) {
  const postId = Number(req.params.id);

  if (!postId || isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid discussion ID.' });
  }

  const pool = getSqlPool();

  try {
    // Verify post exists
    const [posts] = await pool.execute('SELECT post_id FROM Posts WHERE post_id = ?', [postId]);
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Discussion not found.' });
    }

    const userId = req.user.user_id;

    // Check if like already exists
    const [existing] = await pool.execute('SELECT like_id FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]);

    let liked = false;
    if (existing.length > 0) {
      // Unlike
      await pool.execute('DELETE FROM Likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      liked = false;
    } else {
      // Like (handled gracefully with IGNORE in case of race conditions)
      await pool.execute('INSERT IGNORE INTO Likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      liked = true;
    }

    // Get updated like count
    const [countResult] = await pool.execute('SELECT COUNT(*) AS count FROM Likes WHERE post_id = ?', [postId]);
    const likeCount = countResult[0].count;

    return res.json({
      liked,
      like_count: likeCount,
      message: liked ? 'Discussion liked' : 'Like removed'
    });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ error: 'Failed to update like status.' });
  }
}

module.exports = {
  toggleLike
};

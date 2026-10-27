const { ObjectId } = require('mongodb');
const { getReviewsCollection, getSqlPool } = require('../config/db');

const VALID_CATEGORIES = ['Academics', 'Placements', 'Hostels', 'Campus Life', 'Clubs', 'Fees & ROI', 'Faculty'];

async function getReviews(req, res) {
  const reviewsColl = getReviewsCollection();

  try {
    const { college, category, min_rating, user_id, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (user_id) {
      filter.user_id = Number(user_id);
    }

    if (college && college.trim()) {
      filter.college_name = college.trim();
    }

    if (category && VALID_CATEGORIES.includes(category)) {
      filter.category = category;
    }

    if (min_rating) {
      const minScore = Number(min_rating);
      if (!isNaN(minScore) && minScore >= 1 && minScore <= 5) {
        filter.rating = { $gte: minScore };
      }
    }

    const total = await reviewsColl.countDocuments(filter);
    const docs = await reviewsColl
      .find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray();

    const currentUserId = req.user ? req.user.user_id : null;

    const reviews = docs.map(d => ({
      ...d,
      _id: d._id.toString(),
      is_author: currentUserId ? d.user_id === currentUserId : false
    }));

    return res.json({
      reviews,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error('getReviews error:', err);
    return res.status(500).json({ error: 'Failed to retrieve reviews.' });
  }
}

async function createReview(req, res) {
  const {
    college_name,
    course_name,
    category,
    rating,
    review_text,
    pros,
    cons,
    advice_to_juniors,
    academic_year
  } = req.body;

  if (!college_name || typeof college_name !== 'string' || !college_name.trim()) {
    return res.status(400).json({ error: 'College name is required.' });
  }

  if (!course_name || typeof course_name !== 'string' || !course_name.trim()) {
    return res.status(400).json({ error: 'Course name is required.' });
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }

  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
  }

  if (!review_text || typeof review_text !== 'string' || review_text.trim().length < 10 || review_text.trim().length > 3000) {
    return res.status(400).json({ error: 'Review text must be between 10 and 3000 characters.' });
  }

  const pool = getSqlPool();
  const reviewsColl = getReviewsCollection();

  try {
    // Attempt to link relational IDs from MySQL for referential mapping
    let collegeId = null;
    let courseId = null;

    try {
      const [cols] = await pool.execute('SELECT college_id FROM Colleges WHERE college_name = ?', [college_name.trim()]);
      if (cols.length) collegeId = cols[0].college_id;

      if (collegeId) {
        const [crs] = await pool.execute(
          'SELECT course_id FROM Courses WHERE college_id = ? AND course_name = ?',
          [collegeId, course_name.trim()]
        );
        if (crs.length) courseId = crs[0].course_id;
      }
    } catch (e) {
      console.warn('MySQL lookup warning during review insertion:', e.message);
    }

    const doc = {
      user_id: req.user.user_id,
      reviewer_name: req.user.name,
      user_role: req.user.role,
      college_id: collegeId,
      college_name: college_name.trim(),
      course_id: courseId,
      course_name: course_name.trim(),
      academic_year: academic_year ? String(academic_year).trim() : (req.user.academic_year || 'Current'),
      category: category.trim(),
      rating: score,
      review_text: review_text.trim(),
      pros: pros ? String(pros).trim() : null,
      cons: cons ? String(cons).trim() : null,
      advice_to_juniors: advice_to_juniors ? String(advice_to_juniors).trim() : null,
      helpful_count: 0,
      created_at: new Date()
    };

    const result = await reviewsColl.insertOne(doc);

    return res.status(201).json({
      message: 'Student review saved in MongoDB',
      review_id: result.insertedId.toString()
    });
  } catch (err) {
    console.error('createReview error:', err);
    return res.status(500).json({ error: 'Failed to submit review.' });
  }
}

async function deleteReview(req, res) {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid review document ID.' });
  }

  const reviewsColl = getReviewsCollection();

  try {
    const doc = await reviewsColl.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return res.status(404).json({ error: 'Review document not found.' });
    }

    // Ownership check
    if (doc.user_id !== req.user.user_id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to delete this review.' });
    }

    await reviewsColl.deleteOne({ _id: new ObjectId(id) });

    return res.json({ message: 'Review document removed from MongoDB' });
  } catch (err) {
    console.error('deleteReview error:', err);
    return res.status(500).json({ error: 'Failed to delete review.' });
  }
}

async function getReviewSummary(_req, res) {
  const reviewsColl = getReviewsCollection();

  try {
    const [stats] = await reviewsColl.aggregate([
      {
        $group: {
          _id: null,
          avg_rating: { $avg: '$rating' },
          total_reviews: { $sum: 1 },
          ratings_5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          ratings_4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          ratings_3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          ratings_2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          ratings_1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]).toArray();

    const categoryBreakdown = await reviewsColl.aggregate([
      {
        $group: {
          _id: '$category',
          avg_rating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    return res.json({
      overall: stats ? {
        ...stats,
        avg_rating: Number(stats.avg_rating.toFixed(2))
      } : { avg_rating: 0, total_reviews: 0 },
      categories: categoryBreakdown.map(c => ({
        category: c._id,
        avg_rating: Number(c.avg_rating.toFixed(1)),
        count: c.count
      }))
    });
  } catch (err) {
    console.error('getReviewSummary error:', err);
    return res.status(500).json({ error: 'Failed to compute review statistics.' });
  }
}

module.exports = {
  getReviews,
  createReview,
  deleteReview,
  getReviewSummary
};

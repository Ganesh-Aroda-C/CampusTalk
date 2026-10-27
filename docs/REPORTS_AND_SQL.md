# CampusTalk — DBMS Reports, SQL Queries & MongoDB Aggregations

This document provides the complete technical explanation and exact queries for the **7 DBMS evaluation reports** implemented in CampusTalk. Every report is backed by real persisted data in MySQL or MongoDB.

---

## Report 1: College-Wise Discussion Activity
* **Objective:** Determine the discussion volume across colleges, including institutions that have zero discussions.
* **Database:** MySQL 8.0
* **Key DBMS Concepts:** `LEFT JOIN`, `GROUP BY`, `COUNT(DISTINCT)` to prevent Cartesian product inflation.

```sql
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
ORDER BY total_posts DESC, total_comments DESC, cl.college_name ASC;
```

> **Viva Note:** Why `COUNT(DISTINCT)`? When a post has 3 comments and 4 likes, a plain `JOIN` produces $3 \times 4 = 12$ rows for that post. Using `COUNT(DISTINCT cm.comment_id)` ensures the accurate comment count (3) is returned.

---

## Report 2: Course-Wise Discussion Activity
* **Objective:** Identify which academic courses receive the most student engagement.
* **Database:** MySQL 8.0
* **Key DBMS Concepts:** Multi-table relational joins, composite sorting.

```sql
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
ORDER BY total_posts DESC, total_comments DESC, c.course_name ASC;
```

---

## Report 3: Most Discussed Topics & Distribution Share
* **Objective:** Breakdown of discussions across topics (Academics, Placements, Hostels, etc.) with relative market share percentages.
* **Database:** MySQL 8.0
* **Key DBMS Concepts:** Subquery in `SELECT`, `ROUND()`, aggregate division.

```sql
SELECT p.topic,
       COUNT(p.post_id) AS total_posts,
       ROUND(COUNT(p.post_id) * 100.0 / (SELECT NULLIF(COUNT(*), 0) FROM Posts), 1) AS percentage,
       COUNT(DISTINCT cm.comment_id) AS total_comments,
       COUNT(DISTINCT l.like_id) AS total_likes
FROM Posts p
LEFT JOIN Comments cm ON cm.post_id = p.post_id
LEFT JOIN Likes l ON l.post_id = p.post_id
GROUP BY p.topic
ORDER BY total_posts DESC, total_comments DESC;
```

---

## Report 4: Most Useful Discussions (Composite Ranking)
* **Objective:** Identify the highest-value community questions using an engagement heuristic score ($2 \times \text{Likes} + 3 \times \text{Comments}$).
* **Database:** MySQL 8.0
* **Key DBMS Concepts:** Weighted arithmetic formulas in `ORDER BY`, pagination with `LIMIT`.

```sql
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
LIMIT 10;
```

---

## Report 5: Average Review Rating by College & Course
* **Objective:** Calculate statistical rating distributions across institutions based on student experience documents.
* **Database:** MongoDB 7.0+ (Aggregation Pipeline)
* **Key NoSQL Concepts:** Multi-stage pipeline: `$group`, `$project`, `$avg`, `$min`, `$max`, `$round`, `$sort`.

```javascript
db.student_reviews.aggregate([
  {
    $group: {
      _id: { college: "$college_name", course: "$course_name" },
      avg_rating: { $avg: "$rating" },
      min_rating: { $min: "$rating" },
      max_rating: { $max: "$rating" },
      total_reviews: { $sum: 1 }
    }
  },
  {
    $project: {
      college_name: "$_id.college",
      course_name: "$_id.course",
      avg_rating: { $round: ["$avg_rating", 2] },
      min_rating: 1,
      max_rating: 1,
      total_reviews: 1,
      _id: 0
    }
  },
  { $sort: { avg_rating: -1, total_reviews: -1 } }
]);
```

---

## Report 6: Review Counts by College & Category
* **Objective:** Breakdown of reviews categorized by college facet (Academics, Placements, Hostels, Campus Life).
* **Database:** MongoDB 7.0+ (Aggregation Pipeline)
* **Key NoSQL Concepts:** Compound grouping keys.

```javascript
db.student_reviews.aggregate([
  {
    $group: {
      _id: { college: "$college_name", category: "$category" },
      total_reviews: { $sum: 1 },
      avg_rating: { $avg: "$rating" }
    }
  },
  {
    $project: {
      college_name: "$_id.college",
      category: "$_id.category",
      total_reviews: 1,
      avg_rating: { $round: ["$avg_rating", 2] },
      _id: 0
    }
  },
  { $sort: { college_name: 1, total_reviews: -1 } }
]);
```

---

## Report 7: Monthly Activity Timeline
* **Objective:** Track adoption and student participation trends over time across both storage engines.
* **Database:** Hybrid (MySQL `DATE_FORMAT` + MongoDB `$dateToString`)

**MySQL Query:**
```sql
SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(post_id) AS posts_count,
       COUNT(DISTINCT user_id) AS active_authors
FROM Posts
GROUP BY DATE_FORMAT(created_at, '%Y-%m')
ORDER BY month ASC;
```

**MongoDB Pipeline:**
```javascript
db.student_reviews.aggregate([
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
      reviews_count: { $sum: 1 }
    }
  },
  { $sort: { _id: 1 } }
]);
```

The Express API controller merges these two time-series on the common `month` key, returning a combined unified timeline:
```json
[
  { "month": "2026-08", "posts_count": 4, "active_authors": 3, "reviews_count": 2 },
  { "month": "2026-09", "posts_count": 3, "active_authors": 2, "reviews_count": 3 },
  { "month": "2026-10", "posts_count": 2, "active_authors": 2, "reviews_count": 2 }
]
```

---

## 8. CSV Export Implementation
Every report can be exported directly from the browser by visiting `/api/reports/export/:reportType`. The server streams standard RFC 4180 CSV with escaped string fields and proper content disposition headers (`attachment; filename="campustalk_report_college-posts.csv"`).

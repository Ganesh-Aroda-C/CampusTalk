USE campustalk;

-- Report 1: number of discussions for every college, including colleges with zero posts.
SELECT cl.college_name, COUNT(p.post_id) AS total_posts
FROM Colleges cl
LEFT JOIN Courses c ON c.college_id = cl.college_id
LEFT JOIN Posts p ON p.course_id = c.course_id
GROUP BY cl.college_id, cl.college_name
ORDER BY total_posts DESC;

-- Report 2: number of posts in each topic.
SELECT topic, COUNT(*) AS total_posts
FROM Posts
GROUP BY topic
ORDER BY total_posts DESC;

-- Report 3: posts with most comments (a useful-discussion proxy).
SELECT p.post_id, p.title, cl.college_name, COUNT(cm.comment_id) AS total_comments
FROM Posts p
JOIN Courses c ON c.course_id = p.course_id
JOIN Colleges cl ON cl.college_id = c.college_id
LEFT JOIN Comments cm ON cm.post_id = p.post_id
GROUP BY p.post_id, p.title, cl.college_name
ORDER BY total_comments DESC;

-- Report 4: most liked posts.
SELECT p.post_id, p.title, u.name AS author, COUNT(l.like_id) AS likes_received
FROM Posts p
JOIN Users u ON u.user_id = p.user_id
LEFT JOIN Likes l ON l.post_id = p.post_id
GROUP BY p.post_id, p.title, u.name
ORDER BY likes_received DESC;

-- Report 5: student contributions.
SELECT u.name, COUNT(DISTINCT p.post_id) AS posts_created,
       COUNT(DISTINCT cm.comment_id) AS comments_written
FROM Users u
LEFT JOIN Posts p ON p.user_id = u.user_id
LEFT JOIN Comments cm ON cm.user_id = u.user_id
GROUP BY u.user_id, u.name
ORDER BY posts_created DESC, comments_written DESC;

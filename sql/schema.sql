CREATE DATABASE IF NOT EXISTS campustalk;
USE campustalk;

CREATE TABLE IF NOT EXISTS Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  role ENUM('prospective_student','current_student','admin') NOT NULL DEFAULT 'prospective_student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Colleges (
  college_id INT AUTO_INCREMENT PRIMARY KEY,
  college_name VARCHAR(150) NOT NULL UNIQUE,
  location VARCHAR(150) NOT NULL
);

CREATE TABLE IF NOT EXISTS Courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  college_id INT NOT NULL,
  course_name VARCHAR(150) NOT NULL,
  degree_level VARCHAR(50) DEFAULT 'Undergraduate',
  UNIQUE (college_id, course_name),
  CONSTRAINT fk_courses_college FOREIGN KEY (college_id) REFERENCES Colleges(college_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Posts (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  topic ENUM('Academics','Placements','Hostels','Campus Life','Clubs','Admissions','Other') NOT NULL DEFAULT 'Other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_posts_course FOREIGN KEY (course_id) REFERENCES Courses(course_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES Posts(post_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Likes (
  like_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id),
  CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES Posts(post_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS Follows (
  follower_id INT NOT NULL,
  followed_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followed_user_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_follows_followed FOREIGN KEY (followed_user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> followed_user_id)
);

-- Demo data. Safe to run after the schema has been created; IDs are selected by email/name.
INSERT IGNORE INTO Users (name, email, role) VALUES
('Aarav Sharma', 'aarav.demo@campustalk.local', 'current_student'),
('Meera Rao', 'meera.demo@campustalk.local', 'current_student'),
('Prospective Student', 'prospective.demo@campustalk.local', 'prospective_student');

INSERT IGNORE INTO Colleges (college_name, location) VALUES
('PES University', 'Bengaluru'),
('Example Institute of Technology', 'Pune');

INSERT IGNORE INTO Courses (college_id, course_name, degree_level)
SELECT college_id, 'B.Tech Computer Science', 'Undergraduate' FROM Colleges WHERE college_name='PES University';
INSERT IGNORE INTO Courses (college_id, course_name, degree_level)
SELECT college_id, 'B.Tech Information Technology', 'Undergraduate' FROM Colleges WHERE college_name='Example Institute of Technology';

INSERT INTO Posts (user_id, course_id, title, content, topic)
SELECT u.user_id, c.course_id, 'How manageable is the first-year workload?', 'I would like to understand weekly assignments, labs and exam preparation from current students.', 'Academics'
FROM Users u JOIN Courses c JOIN Colleges cl ON c.college_id=cl.college_id
WHERE u.email='prospective.demo@campustalk.local' AND cl.college_name='PES University'
AND NOT EXISTS (SELECT 1 FROM Posts WHERE title='How manageable is the first-year workload?');

INSERT INTO Comments (post_id, user_id, content)
SELECT p.post_id, u.user_id, 'It can be manageable if you keep up with labs weekly and ask classmates when you get stuck.'
FROM Posts p JOIN Users u ON u.email='aarav.demo@campustalk.local'
WHERE p.title='How manageable is the first-year workload?'
AND NOT EXISTS (SELECT 1 FROM Comments WHERE post_id=p.post_id AND user_id=u.user_id);

INSERT IGNORE INTO Likes (post_id, user_id)
SELECT p.post_id, u.user_id FROM Posts p JOIN Users u ON u.email='meera.demo@campustalk.local'
WHERE p.title='How manageable is the first-year workload?';

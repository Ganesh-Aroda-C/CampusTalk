-- CampusTalk Database Schema
-- RDBMS Engine: MySQL 8.0+
-- Purpose: University DBMS Project & Viva Evaluation

CREATE DATABASE IF NOT EXISTS campustalk;
USE campustalk;

-- 1. Colleges
CREATE TABLE IF NOT EXISTS Colleges (
  college_id INT AUTO_INCREMENT PRIMARY KEY,
  college_name VARCHAR(150) NOT NULL UNIQUE,
  location VARCHAR(150) NOT NULL,
  state VARCHAR(100) NOT NULL DEFAULT 'Karnataka',
  established_year INT NULL,
  website VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_colleges_name (college_name),
  INDEX idx_colleges_location (location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Courses
CREATE TABLE IF NOT EXISTS Courses (
  course_id INT AUTO_INCREMENT PRIMARY KEY,
  college_id INT NOT NULL,
  course_name VARCHAR(150) NOT NULL,
  degree_level ENUM('Undergraduate', 'Postgraduate', 'Diploma', 'Doctorate') DEFAULT 'Undergraduate',
  duration_years INT DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_college_course (college_id, course_name),
  CONSTRAINT fk_courses_college FOREIGN KEY (college_id) REFERENCES Colleges(college_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_courses_college (college_id),
  INDEX idx_courses_name (course_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Topics (Reference / Category Table)
CREATE TABLE IF NOT EXISTS Topics (
  topic_id INT AUTO_INCREMENT PRIMARY KEY,
  topic_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT 'chat',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Users
CREATE TABLE IF NOT EXISTS Users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('prospective_student', 'current_student', 'admin') NOT NULL DEFAULT 'prospective_student',
  college_id INT NULL,
  course_id INT NULL,
  academic_year VARCHAR(50) NULL,
  bio TEXT NULL,
  interests VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_college FOREIGN KEY (college_id) REFERENCES Colleges(college_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_users_course FOREIGN KEY (course_id) REFERENCES Courses(course_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Posts (Discussions)
CREATE TABLE IF NOT EXISTS Posts (
  post_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  topic ENUM('Academics', 'Placements', 'Hostels', 'Campus Life', 'Clubs', 'Admissions', 'Faculty', 'Fees & ROI', 'Other') NOT NULL DEFAULT 'Other',
  academic_year VARCHAR(50) NULL,
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_posts_course FOREIGN KEY (course_id) REFERENCES Courses(course_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_posts_user (user_id),
  INDEX idx_posts_course (course_id),
  INDEX idx_posts_topic (topic),
  INDEX idx_posts_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Comments
CREATE TABLE IF NOT EXISTS Comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES Posts(post_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_comments_post (post_id),
  INDEX idx_comments_user (user_id),
  INDEX idx_comments_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Likes
CREATE TABLE IF NOT EXISTS Likes (
  like_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_likes_post_user (post_id, user_id),
  CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES Posts(post_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_likes_post (post_id),
  INDEX idx_likes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Follows
CREATE TABLE IF NOT EXISTS Follows (
  follower_id INT NOT NULL,
  followed_user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, followed_user_id),
  CONSTRAINT fk_follows_follower FOREIGN KEY (follower_id) REFERENCES Users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_follows_followed FOREIGN KEY (followed_user_id) REFERENCES Users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> followed_user_id),
  INDEX idx_follows_followed (followed_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial Topics Population
INSERT IGNORE INTO Topics (topic_name, description, icon) VALUES
('Academics', 'Curriculum, course difficulty, exams, and grading', 'book-open'),
('Placements', 'Campus placement statistics, recruitment drives, and internships', 'briefcase'),
('Hostels', 'Hostel accommodation, food quality, safety, and amenities', 'home'),
('Campus Life', 'Campus atmosphere, fests, sports facilities, and culture', 'smile'),
('Clubs', 'Technical societies, cultural clubs, and student organizations', 'users'),
('Admissions', 'Cutoffs, eligibility, counseling, and entrance exams', 'award'),
('Faculty', 'Teaching quality, mentorship, and research opportunities', 'user-check'),
('Fees & ROI', 'Tuition fees, scholarships, and return on investment', 'dollar-sign'),
('Other', 'General queries and diverse campus discussions', 'message-circle');

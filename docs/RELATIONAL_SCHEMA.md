# CampusTalk — Relational Schema & Normalization Analysis

CampusTalk's relational database is hosted on **MySQL 8.0+** using the **InnoDB** storage engine. This document provides the formal mathematical representation of the relations, functional dependencies, constraint catalog, and normal form proofs suitable for DBMS viva and laboratory defense.

---

## 1. Relational Table Specifications

### 1.1 `Colleges`
Authoritative directory of recognized educational institutions.
* **Primary Key:** `college_id` (INT, AUTO_INCREMENT)
* **Alternate / Unique Key:** `college_name` (VARCHAR(150))
* **Attributes:**
  * `location` VARCHAR(150) NOT NULL
  * `state` VARCHAR(100) NOT NULL DEFAULT 'Karnataka'
  * `established_year` INT NULL
  * `website` VARCHAR(200) NULL
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
* **Indexes:** `idx_colleges_name` on `college_name`, `idx_colleges_location` on `location`

### 1.2 `Courses`
Degree programs offered by institutions.
* **Primary Key:** `course_id` (INT, AUTO_INCREMENT)
* **Foreign Key:** `college_id` &rarr; `Colleges(college_id)` ON DELETE CASCADE ON UPDATE CASCADE
* **Unique Constraint:** `uq_college_course` (`college_id`, `course_name`)
* **Attributes:**
  * `course_name` VARCHAR(150) NOT NULL
  * `degree_level` ENUM('Undergraduate', 'Postgraduate', 'Diploma', 'Doctorate') DEFAULT 'Undergraduate'
  * `duration_years` INT DEFAULT 4
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
* **Indexes:** `idx_courses_college`, `idx_courses_name`

### 1.3 `Topics`
Reference classification catalog for discussions.
* **Primary Key:** `topic_id` (INT, AUTO_INCREMENT)
* **Unique Key:** `topic_name` VARCHAR(50)
* **Attributes:**
  * `description` VARCHAR(255) NOT NULL
  * `icon` VARCHAR(50) DEFAULT 'chat'
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### 1.4 `Users`
Registered students, alumni, and administrators.
* **Primary Key:** `user_id` (INT, AUTO_INCREMENT)
* **Unique Key:** `email` VARCHAR(150)
* **Attributes:**
  * `name` VARCHAR(100) NOT NULL
  * `password_hash` VARCHAR(255) NOT NULL (bcrypt hashed with salt)
  * `role` ENUM('prospective_student', 'current_student', 'admin') DEFAULT 'prospective_student'
  * `college_id` INT NULL &rarr; `Colleges(college_id)` ON DELETE SET NULL ON UPDATE CASCADE
  * `course_id` INT NULL &rarr; `Courses(course_id)` ON DELETE SET NULL ON UPDATE CASCADE
  * `academic_year` VARCHAR(50) NULL
  * `bio` TEXT NULL
  * `interests` VARCHAR(255) NULL
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  * `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
* **Indexes:** `idx_users_email`, `idx_users_role`, `idx_users_college`

### 1.5 `Posts`
College-specific discussion questions and insights.
* **Primary Key:** `post_id` (INT, AUTO_INCREMENT)
* **Foreign Keys:**
  * `user_id` &rarr; `Users(user_id)` ON DELETE CASCADE ON UPDATE CASCADE
  * `course_id` &rarr; `Courses(course_id)` ON DELETE CASCADE ON UPDATE CASCADE
* **Attributes:**
  * `title` VARCHAR(200) NOT NULL
  * `content` TEXT NOT NULL
  * `topic` ENUM('Academics', 'Placements', 'Hostels', 'Campus Life', 'Clubs', 'Admissions', 'Faculty', 'Fees & ROI', 'Other') DEFAULT 'Other'
  * `academic_year` VARCHAR(50) NULL
  * `view_count` INT NOT NULL DEFAULT 0
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  * `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
* **Indexes:** `idx_posts_user`, `idx_posts_course`, `idx_posts_topic`, `idx_posts_created_at`

### 1.6 `Comments`
Threaded replies and advice on discussions.
* **Primary Key:** `comment_id` (INT, AUTO_INCREMENT)
* **Foreign Keys:**
  * `post_id` &rarr; `Posts(post_id)` ON DELETE CASCADE ON UPDATE CASCADE
  * `user_id` &rarr; `Users(user_id)` ON DELETE CASCADE ON UPDATE CASCADE
* **Attributes:**
  * `content` TEXT NOT NULL
  * `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  * `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
* **Indexes:** `idx_comments_post`, `idx_comments_user`, `idx_comments_created_at`

### 1.7 `Likes`
Positive endorsements on questions.
* **Primary Key:** `like_id` (INT, AUTO_INCREMENT)
* **Foreign Keys:**
  * `post_id` &rarr; `Posts(post_id)` ON DELETE CASCADE ON UPDATE CASCADE
  * `user_id` &rarr; `Users(user_id)` ON DELETE CASCADE ON UPDATE CASCADE
* **Unique Constraint:** `uq_likes_post_user` (`post_id`, `user_id`) &mdash; prevents double-voting.
* **Attributes:** `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
* **Indexes:** `idx_likes_post`, `idx_likes_user`

### 1.8 `Follows`
Peer-to-peer student mentorship connections.
* **Composite Primary Key:** (`follower_id`, `followed_user_id`)
* **Foreign Keys:**
  * `follower_id` &rarr; `Users(user_id)` ON DELETE CASCADE
  * `followed_user_id` &rarr; `Users(user_id)` ON DELETE CASCADE
* **Check Constraint:** `chk_no_self_follow CHECK (follower_id <> followed_user_id)`
* **Indexes:** `idx_follows_followed`

---

## 2. Normalization Defense

### First Normal Form (1NF)
* All attributes contain strictly atomic values.
* No repeating groups or multi-valued columns (e.g., comments and likes are separate tables rather than comma-separated lists in Posts).
* Each table has an explicit primary key.

### Second Normal Form (2NF)
* Meets 1NF.
* All non-prime attributes are fully functionally dependent on candidate keys.
* In composite-key tables like `Follows (follower_id, followed_user_id)`, `created_at` depends on the full composite key, eliminating partial dependencies.

### Third Normal Form (3NF)
* Meets 2NF.
* No transitive dependencies exist between non-prime attributes.
* *Example:* In a non-normalized design, `Posts` might store `college_name` alongside `course_id`. That would create a transitive dependency: `post_id &rarr; course_id &rarr; college_id &rarr; college_name`. CampusTalk normalizes this into `Colleges &rarr; Courses &rarr; Posts`.

### Boyce-Codd Normal Form (BCNF)
* For every non-trivial functional dependency $X \rightarrow Y$, the determinant $X$ is a superkey.
* In `Courses`, $(college\_id, course\_name) \rightarrow (course\_id, degree\_level, duration\_years)$. Both `course_id` and $(college\_id, course\_name)$ are valid candidate keys.

---

## 3. Anomaly Elimination

| Anomaly Type | Problem in Unnormalized Schema | CampusTalk Solution |
|---|---|---|
| **Insertion Anomaly** | Cannot store a new college until a course or post is created. | `Colleges` is an independent master relation; colleges exist prior to courses. |
| **Deletion Anomaly** | Deleting the last discussion about a college erases the college's record from the database. | `Posts` references `Courses`, which references `Colleges`. Deleting posts has zero effect on `Colleges`. |
| **Update Anomaly** | Changing a college's name requires updating hundreds of denormalized post rows. | College name is stored exactly once in `Colleges`. Any join immediately reflects updates across all posts. |

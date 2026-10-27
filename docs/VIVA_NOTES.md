# CampusTalk — Comprehensive DBMS Viva Preparation Notes

## Project Explanation (30 Seconds Pitch)
CampusTalk is a full-stack, polyglot persistence discussion and student-review platform designed to eliminate information asymmetry for college applicants. Prospective students research colleges and courses by reading authentic experiences shared by verified current students. We use **MySQL 8.0** for relational domain entities (Users, Colleges, Courses, Posts, Comments, Likes, and Follows) with strict referential integrity and ACID transactions, paired with **MongoDB** for flexible, category-specific student experience reviews and aggregation pipelines. An Express REST API serves a responsive, Instagram/Threads-inspired student UI and provides 7 live, database-backed analytical reports for DBMS evaluation.

---

## High-Yield Viva Questions & Answers

### 1. Why did you choose a Polyglot Persistence Architecture (MySQL + MongoDB)?
- **MySQL 8.0 (Relational Store):** Ideal for core application entities with structured relationships, foreign keys, cascade rules, and transactional integrity (e.g. like toggles, user accounts, post/comment threads).
- **MongoDB (Document Store):** Ideal for student experience reviews. Review attributes vary widely by category (e.g., *Hostels* have mess/curfew details; *Placements* have salary packages/internships; *Academics* have assignment workloads). Storing this in SQL would cause sparse tables filled with `NULL`s or require an anti-pattern like EAV (Entity-Attribute-Value).

### 2. What normal form does your relational schema achieve?
- The schema is normalized up to **Boyce-Codd Normal Form (BCNF)** / **3rd Normal Form (3NF)**:
  - **1NF:** All attributes are atomic; no repeating groups.
  - **2NF:** Every non-key attribute is fully functionally dependent on the entire primary key (no partial dependencies).
  - **3NF:** No transitive functional dependencies (e.g., `college_id` is not repeated on `posts`; posts reference `course_id`, which references `college_id`).
  - **BCNF:** For every non-trivial functional dependency $X \rightarrow Y$, $X$ is a superkey.

### 3. How do you prevent SQL injection?
- All database queries use **parameterized prepared statements** via `mysql2/promise` (e.g. `pool.execute('SELECT ... WHERE user_id = ?', [userId])`). User inputs are never concatenated directly into raw SQL query strings.

### 4. What is a primary key and a foreign key in your schema?
- **Primary Key:** A unique, non-null identifier for a row (e.g., `user_id` in `Users`, `post_id` in `Posts`).
- **Foreign Key:** An attribute referencing the primary key of another table, enforcing referential integrity (e.g., `Posts.course_id` references `Courses.course_id` with `ON DELETE CASCADE`).

### 5. Why use a `LEFT JOIN` instead of an `INNER JOIN` in college activity reports?
- An `INNER JOIN` would exclude colleges that do not yet have any posts or reviews.
- A `LEFT JOIN` preserves all colleges from the parent table, allowing our analytics query to display `0` posts for new or quieter institutions.

### 6. Why use `COUNT(DISTINCT ...)` in aggregate queries?
- When joining `Posts` to both `Comments` and `Likes` simultaneously, a Cartesian product occurs ($2 \text{ comments} \times 3 \text{ likes} = 6 \text{ rows}$). `COUNT(DISTINCT c.comment_id)` and `COUNT(DISTINCT l.like_id)` prevent inflated, duplicate counts.

### 7. How does the Unanswered Questions feature work in SQL?
- It uses a `GROUP BY` with a `HAVING` clause:
  ```sql
  SELECT p.post_id, p.title, COUNT(c.comment_id) AS comment_count
  FROM Posts p
  LEFT JOIN Comments c ON p.post_id = c.post_id
  GROUP BY p.post_id
  HAVING comment_count = 0;
  ```
  This surfaces questions with zero answers so current college seniors can help incoming students.

### 8. How do you prevent a user from liking a post multiple times?
- We enforce a composite **UNIQUE constraint** at the database level: `UNIQUE KEY uq_likes_post_user (post_id, user_id)`.
- If an insert violates this constraint, our atomic controller catches the duplicate or toggles the like off (`DELETE`).

### 9. How is security and authentication handled?
- Passwords are encrypted using **bcrypt** (cost factor 10) before storage. Plaintext passwords or password hashes are never returned in API responses.
- Stateless authentication uses cryptographically signed **JSON Web Tokens (JWT)**.
- Server-side authorization checks verify ownership before allowing any `PUT` or `DELETE` on posts, comments, or reviews.

### 10. How does MongoDB aggregation work in your project?
- We use multi-stage aggregation pipelines (`$match`, `$group`, `$sort`, `$project`) to compute real-time metrics:
  - Average rating and review count per college.
  - Review category breakdowns (e.g., Academics vs Placements vs Hostels).

### 11. What is the indexing strategy?
- **MySQL:** Indexes on frequently filtered/joined foreign keys (`idx_posts_course`, `idx_posts_user`, `idx_posts_created_at`, `idx_courses_college`, and composite index on `Likes(post_id, user_id)`).
- **MongoDB:** Compound indexes on `{ college_id: 1, category: 1 }` and `{ user_id: 1, created_at: -1 }`.

### 12. What are the defensible academic limitations?
1. **Self-declared roles:** In this lab prototype, students select their role upon registration. A production deployment would require `.edu` institutional email domain verification.
2. **Search scaling:** Search currently uses parameterized SQL `LIKE` and compound indexes. High-throughput enterprise scaling would employ a dedicated inverted index engine like Elasticsearch or Meilisearch.
3. **Dual-store consistency:** Coordinated via application logic (eventual consistency) rather than a heavy distributed 2-Phase Commit (2PC) to maintain sub-10ms response times.

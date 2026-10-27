# CampusTalk — Database Architecture & Polyglot Persistence Design

CampusTalk adopts a **Polyglot Persistence Architecture**, intentionally pairing a relational database (**MySQL 8.0**) with a document-oriented database (**MongoDB 7.0+**) to address distinct data modeling challenges.

---

## 1. Architectural Motivation & Store Ownership

```
                       +---------------------------+
                       |    CampusTalk Client      |
                       +-------------+-------------+
                                     |
                                     v
                       +-------------+-------------+
                       |    Node.js / Express      |
                       |    (API & Logic Layer)    |
                       +------+-------------+------+
                              |             |
           Relational Queries |             | BSON Documents &
           ACID Transactions  |             | Aggregations
                              v             v
                    +---------+--+       +--+---------+
                    |   MySQL    |       |  MongoDB   |
                    |   (RDBMS)  |       |  (NoSQL)   |
                    +------------+       +------------+
```

| Database | Model | Primary Responsibilities | Justification |
|---|---|---|---|
| **MySQL 8.0 (InnoDB)** | Relational | Users, Colleges, Courses, Posts, Comments, Likes, Follows | Strict schema enforcement, ACID guarantees, foreign key cascades, mathematical joins, and transactional consistency for votes/likes. |
| **MongoDB 7.0+ (WiredTiger)** | Document (NoSQL) | Student Experience Reviews (`student_reviews`) | Heterogeneous schema: reviews have category-dependent structures (hostels have curfew/mess attributes; placements have CTC/internship attributes; academics have workload/ISA attributes). Storing this in SQL would require many NULL columns or an awkward EAV pattern. |

---

## 2. Cross-Database Identifier Mapping Strategy

1. **Authoritative Entities in MySQL:**
   Institutions (`Colleges`), Degree Programs (`Courses`), and Accounts (`Users`) originate in MySQL with auto-incrementing integer Primary Keys (`college_id`, `course_id`, `user_id`).

2. **Denormalization in MongoDB Documents:**
   When a review document is inserted into MongoDB:
   * It stores `user_id`, `college_id`, and `course_id` as foreign references.
   * It stores snapshot text representations (`college_name`, `course_name`, `reviewer_name`, `user_role`).
   * *Benefit:* Review feeds and category aggregations can be served directly from MongoDB without round-trip joins to MySQL, achieving high read throughput.

3. **Consistency Strategy (Eventual Consistency):**
   * Distributed two-phase commit across MySQL and MongoDB is deliberately avoided because it introduces high latency and failure fragility.
   * If a user updates their profile in MySQL, old reviews preserve the reviewer name at the time of writing (historical audit trail).
   * If a college is deleted in MySQL, any orphan review documents in MongoDB are flagged or cleaned up via asynchronous maintenance scripts.

---

## 3. Storage Engines & Optimization

### MySQL (InnoDB)
* **Buffer Pool:** Configured for high-concurrency read operations.
* **Connection Pooling:** `mysql2/promise` pool with `connectionLimit: 10` and `keepAlive: true`.
* **Covering Indexes:**
  * `Likes (post_id, user_id)`: Index satisfies the lookup for like status and total counts directly from index pages without reading data rows.
  * `Posts (course_id, topic, created_at)`: Optimizes multi-criteria filtering on the discussion feed.

### MongoDB (WiredTiger)
* **Indexes:**
  * Compound index `{ college_name: 1, category: 1 }` for category filtering.
  * Compound index `{ college_id: 1, rating: -1 }` for rating leaderboards.
  * Index `{ created_at: -1 }` for chronological feeds.
* **Document Validation:** Enforces integer rating constraints (1 &le; rating &le; 5) and string bounds directly in the database driver.

---

## 4. Failure Handling & Resilience

* **Database Connection Failure Isolation:** If MongoDB becomes temporarily unreachable, MySQL discussion features (questions, comments, likes) remain completely operational. The `/api/health` endpoint surfaces isolated connection statuses (`{ server: 'ok', mysql: 'connected', mongodb: 'not connected' }`).
* **Connection Auto-Recovery:** Both drivers implement automated reconnection logic with exponential backoff.
* **Embedded Development Fallback:** In local Windows development environments where a global MongoDB daemon is not running as a system service, CampusTalk includes an automated binary launcher that initializes a local MongoDB instance against `%LOCALAPPDATA%\CampusTalkMongo`.

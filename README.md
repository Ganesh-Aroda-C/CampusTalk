# CampusTalk — College Student Discussion & Experience Platform

CampusTalk is a full-stack, polyglot persistence web platform designed for college discussion and student information discovery, as well as university DBMS laboratory evaluations and viva examinations. It connects prospective students researching colleges and degree programs with current students sharing first-hand experiences regarding academics, workload, hostels, placements, fees, and campus culture.

---

## 1. Project Overview & Problem Statement

### The Problem
Prospective students struggle to find reliable, unbiased, first-hand information about institutions and specific degree programs. Discussion is scattered across disparate social media threads, unstructured chat groups, and promotional university websites.

### The Solution
CampusTalk organizes questions, answers, and reviews under a structured hierarchy of **Colleges &rarr; Courses &rarr; Topics**. 
* **Current students** provide verified answers and detailed multi-attribute reviews.
* **Prospective students** ask targeted questions, filter by college/course/topic, and compare student ratings.

### Core Novelty & Value
1. **Context-Aware College Discovery:** Multi-criteria exploration filtering simultaneously across College, Degree Level, Topic, and Academic Year.
2. **Database-Backed Unanswered Questions Finder:** A dedicated filter that identifies community questions with 0 responses (`HAVING comment_count = 0`), helping current seniors proactively find and answer questions from prospective juniors.
3. **Dual RDBMS + Document NoSQL Architecture:** Relational integrity for core entities (Users, Colleges, Courses, Posts, Comments, Likes, Follows) alongside MongoDB document collections for heterogeneous reviews.
4. **Clean, Modern Instagram-Inspired Student UX:** Clutter-free visual hierarchy without decorative technical badges in the discussion feeds, paired with dedicated evaluation reports for university examiners.

---

## 2. Technology Stack

* **Backend:** Node.js (v18+ / v22+), Express 4.21
* **Relational Database:** MySQL 8.0+ (InnoDB engine with foreign keys, cascaded deletions, and unique constraints)
* **Document Database:** MongoDB 6.0+ / 7.0+ (WiredTiger engine with compound indexes and multi-stage aggregation pipelines)
* **Authentication & Security:** JSON Web Tokens (JWT), bcryptjs password hashing (cost factor 10), in-memory rate limiting, server-side ownership verification
* **Frontend:** Modern Instagram/Threads-inspired CSS3 design system, Semantic HTML5, Vanilla JavaScript (ES6+ modular architecture, zero heavy external UI dependencies), WCAG 2.2 AA accessibility (focus trapping, visible focus outlines, live regions)
* **Testing:** Node.js native test runner (`node:test`, `node:assert/strict`)

---

## 3. Database Architecture & Roles

```
                              CampusTalk API (Express)
                                    |        |
                   +----------------+        +----------------+
                   |                                          |
                   v                                          v
       MySQL 8.0 Relational Store                  MongoDB Document Store
     (Authoritative Domain Entities)           (Flexible Experience Reviews)
   ------------------------------------       -------------------------------
   • Colleges (PK: college_id)                • Collection: student_reviews
   • Courses (PK: course_id, FK: college_id)    - review_id, user_id, college_id
   • Topics (PK: topic_id)                      - reviewer_name, user_role
   • Users (PK: user_id, FKs: college,course)   - category, rating (1-5)
   • Posts (PK: post_id, FKs: user,course)      - review_text, pros, cons
   • Comments (PK: comment_id, FKs: post,user)  - advice_to_juniors
   • Likes (PK: like_id, UK: post_id,user_id)   - helpful_count, created_at
   • Follows (PK: follower_id,followed_id)
```

For complete database schema and documentation, see:
* [ER Diagram](docs/ER_DIAGRAM.md) &mdash; Mermaid notation ER diagram with cardinalities.
* [Relational Schema](docs/RELATIONAL_SCHEMA.md) &mdash; 1NF, 2NF, 3NF, BCNF proofs and constraint catalog.
* [Database Design](docs/DATABASE_DESIGN.md) &mdash; Polyglot persistence, consistency strategy, and failure handling.
* [Reports & SQL Queries](docs/REPORTS_AND_SQL.md) &mdash; Exact SQL joins, GROUP BY queries, MongoDB aggregation pipelines, and CSV export.
* [Viva Examination Notes](docs/VIVA_NOTES.md) &mdash; High-yield answers for laboratory examiners.

---

## 4. Intuitive User Interface & Layout Structure

The interface follows clean UX principles inspired by modern social platforms (Instagram / Threads), removing confusing technical labels and badges from student content while answering three core questions on every view:
1. **Where am I?** (Clear headings, active navigation indicators, breadcrumb badges).
2. **What can I do here?** (Prominent primary action, visible filters, straightforward search).
3. **What is the next obvious action?** (Clear call-to-actions, inline comment drawer, heart like toggle).

### Layout Components

```
+------------------+--------------------------------------+-------------------+
|  LEFT SIDEBAR    |          CENTER CONTENT FEED         |    RIGHT RAIL     |
|                  |                                      |                   |
|  * CampusTalk    |  [ Search colleges, courses, Qs... ] |  Unanswered Qs    |
|  * Home          |  [ Filter Pills: Academics, Fees...]|  (0 responses)    |
|  * Explore       |                                      |                   |
|  * Discussions   |  +--------------------------------+  |  Popular Colleges |
|  * Reviews       |  | Post Card                      |  |  (quick jump)     |
|  * Ask Question  |  | Author avatar, course context  |  |                   |
|  * Notifications |  | Question title & clean preview |  |  Evaluator Link:  |
|  * Profile       |  | Heart like & Comment drawer    |  |  [DBMS Reports]   |
|  * Settings      |  +--------------------------------+  |                   |
+------------------+--------------------------------------+-------------------+
```

* **Desktop Navigation (Left Sidebar):** Consistent access to Home, Explore Colleges, Discussions, Reviews, Ask a Question (+), Notifications, Profile, and Settings.
* **Mobile-First Experience:** Compact top bar with logo and notifications, paired with an ergonomic bottom navigation bar (Home, Explore, Ask [+], Reviews, Profile).
* **Instant Global Search:** Real-time dropdown returning matched Colleges, Courses, Discussions, and Reviews as you type.
* **Dedicated College Detail Page:** Structured tabs for Discussions, Student Reviews, Courses Offered, and Institutional Overview.
* **Unobtrusive Evaluator Reports:** Access all 7 SQL & MongoDB analytical reports and CSV downloads via **Settings &rarr; "Launch DBMS Lab Reports"** or from the right rail footer.

---

## 5. Key Features

### A. Authentication & Profiles
* Secure user registration and login with bcrypt password hashing (minimum 6 characters).
* Role differentiation: `current_student`, `prospective_student`, and `admin`.
* Session persistence using signed JWT tokens stored securely.
* Server-side ownership enforcement: users can only edit or delete their own posts, comments, and reviews.
* Sensitive fields (`password_hash`) are strictly excluded from API responses.

### B. Discussion Feed
* Rich discussion creation linked to specific colleges, courses, and topics.
* Multi-criteria filtering by College, Course, Topic, and Search query.
* Sort modes: Most Recent, Most Popular ($2 \times \text{Likes} + 3 \times \text{Comments}$), Unanswered Questions, and Most Liked.
* Atomic, idempotent Like/Unlike toggling with database unique constraint (`uq_likes_post_user`).
* Inline threaded comments with immediate count updates.

### C. College & Course Discovery
* Directory of institutions showing course counts, post volumes, and average student review ratings.
* Course catalog displaying degree level, duration, and post activity.
* Direct action buttons to filter feed discussions or write reviews for a selected institution.

### D. Student Experience Reviews (MongoDB)
* Multi-faceted student reviews capturing Academics, Placements, Hostels, Campus Life, Clubs, and Fees & ROI.
* Star rating system (1 to 5 stars) with category breakdown.
* Unstructured fields (Pros, Cons, Advice to Juniors) demonstrating MongoDB's flexible schema.

### E. DBMS Reports & Analytics Dashboard
* 7 live database-backed reports (no hardcoded or simulated values):
  1. College-wise Discussion Activity (MySQL `LEFT JOIN` & `COUNT(DISTINCT)`).
  2. Course-wise Discussion Activity (Posts, Comments, Likes).
  3. Most Discussed Topics with percentage share.
  4. Most Useful Discussions ranked by composite engagement score.
  5. Average Review Ratings by College & Course (MongoDB Aggregation Pipeline).
  6. Review Counts by College & Category (MongoDB Compound Grouping).
  7. Monthly Discussion & Review Timeline (Combined SQL + NoSQL time-series).
* Accessible interactive visual bar graphs.
* Direct **CSV Export** for each report.

### F. Accessibility (WCAG 2.2 AA)
* Accessible dialogs with focus trapping, restore-focus on close, and `Escape` key listeners.
* Screen-reader friendly live status notifications (`role="status"`, `aria-live="polite"`).
* High-contrast styling with visible focus outlines (`outline: 2px solid #4f46e5`).
* Responsive layouts from mobile screens (320px) up to ultra-wide displays.

---

## 6. Local Setup & Execution (Windows / VS Code)

### Prerequisites
* **Node.js:** v18.0.0 or newer (tested on Node v22.19.0)
* **MySQL Server:** v8.0+ running on port 3306
* **MongoDB:** v6.0+ / v7.0+ (Local daemon or cached binary supported)

### Step 1: Clone & Enter Directory
```powershell
cd c:\Users\gani4\OneDrive\Desktop\Brooklyn\CampusTalk
```

### Step 2: Install Dependencies
```powershell
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` and verify your credentials:
```powershell
cp .env.example .env
```
Ensure `.env` contains your MySQL credentials and ports:
```ini
PORT=5000
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=campustalk
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=campustalk
JWT_SECRET=campustalk_university_dbms_lab_eval_secret_key_2026
NODE_ENV=development
```

### Step 4: Run Database Migrations & Deterministic Seeding
Run the automated schema creation and data seeder:
```powershell
npm run setup-db
```
This script:
1. Creates the MySQL database `campustalk` and all 8 relational tables with constraints and indexes.
2. Seeds realistic demonstration colleges, courses, users (with hashed passwords), discussions, comments, and likes.
3. Seeds MongoDB review documents into the `student_reviews` collection.

*(To re-seed sample data anytime, run `npm run seed`)*.

### Step 5: Start the Application
```powershell
npm start
```
The server will start at: **http://localhost:5000**

---

## 7. Pre-Configured Demo Accounts for Evaluation

All seeded demonstration accounts use the password: `password123`

| Name | Email | Role | Enrolled College & Course |
|---|---|---|---|
| **Aarav Sharma** | `aarav.demo@campustalk.local` | Current Student | PES University &mdash; B.Tech CSE (3rd Year) |
| **Meera Rao** | `meera.demo@campustalk.local` | Current Student | RVCE &mdash; B.Tech ISE (4th Year, Placed at Microsoft) |
| **Rohan Verma** | `rohan.demo@campustalk.local` | Current Student | PICT Pune &mdash; B.Tech Computer Eng (2nd Year Hosteler) |
| **Sneha Patel** | `sneha.demo@campustalk.local` | Prospective Student | Exploring engineering colleges in Karnataka |
| **Vikram Joshi** | `vikram.demo@campustalk.local` | Prospective Student | Deciding between PES and RVCE for CS |
| **Campus Admin** | `admin.demo@campustalk.local` | Administrator | Platform Administration &amp; Moderation |

*(Use the convenient quick-login buttons on the Sign In modal to test switching accounts with a single click)*.

---

## 8. Running Automated Verification Tests

CampusTalk includes an end-to-end integration test suite verifying health checks, authentication, authorization, CRUD operations, database constraints, MongoDB aggregations, and report exports.

Run tests using:
```powershell
npm test
```

Expected output:
```
# tests 9
# suites 0
# pass 9
# fail 0
# duration_ms 1350
```

---

## 9. Common Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| `Access denied for user 'root'@'localhost'` | Incorrect MySQL password in `.env` | Update `MYSQL_PASSWORD` in `.env` to match your local MySQL root password. |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB service is not started | CampusTalk includes an automated local launcher fallback. If needed, start your local `mongod` service or verify the port in `.env`. |
| `Cannot find module 'bcryptjs'` | Node modules not installed | Run `npm install` in the project root. |
| `Database campustalk does not exist` | Database migration not yet run | Run `npm run setup-db` to generate all tables and seed data. |

---

## 10. Academic Limitations & Future Enhancements

* **Email Domain Verification:** Currently, roles are self-declared or administrative. Future versions can require `@college.edu` or institutional email verification for current students.
* **Full-Text Search Engine:** Current search uses parameterized SQL `LIKE` and compound indexes. Production scaling could integrate MySQL Full-Text Search (MATCH...AGAINST) or Elasticsearch.
* **Distributed Two-Phase Commit:** Relational and document updates are coordinated in the application layer. Distributed sagas could be implemented if financial or transaction-critical workloads were added.

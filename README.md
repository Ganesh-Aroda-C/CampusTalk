# CampusTalk — DBMS Project MVP

A compact college-discussion platform starter for the DBMS project evaluation. It uses **MySQL (RDBMS)** for relational entities and reports, **MongoDB (NoSQL)** for flexible student experience reviews, and **Node.js + Express** as the API server. The UI is plain HTML/CSS/JavaScript to keep setup quick; React can be added later if required.

## Features
- Browse/search/filter college discussions
- Create questions and add comments (MySQL)
- Submit student experience reviews (MongoDB)
- Live SQL reports: posts by college, posts by topic, and contributor activity
- Health endpoint to check both database connections

## Requirements
- Node.js 18 or newer
- MySQL 8 (or compatible MySQL server)
- MongoDB Community Server running locally, or a MongoDB connection URI

## Setup on macOS
1. Open Terminal and enter the project directory:
   ```bash
   cd CampusTalk
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Create the MySQL schema and sample data. If your MySQL root account uses a password:
   ```bash
   mysql -u root -p < sql/schema.sql
   ```
   Enter your MySQL password when prompted. If you use a different MySQL account, use that account and update `.env` accordingly.
4. Copy the example environment file and edit it:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set `MYSQL_PASSWORD` to your actual password. Do not commit `.env` or share your password.
5. Start MongoDB. If installed as a Homebrew service, check it with `brew services list`; start it using the service name shown by your installation if needed. For MongoDB Atlas, put your connection string in `MONGODB_URI` and ensure your network/IP access is configured.
6. Start the app:
   ```bash
   npm start
   ```
7. Open http://localhost:5000 in your browser.

## Demo account IDs
The included sample data uses predictable IDs only for a fresh database: user 1 = Aarav Sharma (current student), user 2 = Meera Rao (current student), user 3 = Prospective Student. If your database already had records, IDs may differ; inspect `SELECT user_id,name,email FROM Users;` and update the demo IDs in `public/index.html` if needed.

## API endpoints
- `GET /api/health`
- `GET /api/colleges`, `GET /api/courses`
- `GET /api/posts?college_id=&topic=&q=`
- `POST /api/posts` — JSON: `{ "user_id": 3, "course_id": 1, "title": "...", "content": "...", "topic": "Academics" }`
- `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- `GET /api/reviews`, `POST /api/reviews` — stores flexible review documents in MongoDB
- `GET /api/reports/college-posts`
- `GET /api/reports/topic-counts`
- `GET /api/reports/top-contributors`

## ER model
See `docs/ER_DIAGRAM.md`. The relational schema contains Users, Colleges, Courses, Posts, Comments, Likes and Follows. MongoDB stores documents in the `student_reviews` collection.

## Important project-demo notes
- This is an evaluation MVP, not a production-ready app. Authentication/authorization, input rate limiting, moderation and robust user sessions are not implemented.
- Demo UI actions use fixed sample user IDs; do not present this as real authentication.
- MongoDB review ratings are not included in MySQL reports; they are intentionally stored as flexible NoSQL documents.
- Use only fictional/sample data during your demo.

# CampusTalk — quick DBMS viva notes

## Project explanation (30 seconds)
CampusTalk connects prospective students with current students through searchable college-specific discussions and student experience reviews. MySQL stores entities with clear relationships, such as users, colleges, courses, posts and comments. MongoDB stores flexible experience-review documents, whose categories and optional fields may differ. Express provides API endpoints, and the UI lets users create and browse content. SQL aggregate queries generate reports by college and topic.

## Likely viva questions

**1. Why use an RDBMS?**
Users, courses, posts and comments have structured relationships. MySQL supports primary/foreign keys, joins, constraints and transactions.

**2. Why use MongoDB?**
Student reviews can contain different fields by category. Document storage accommodates optional or category-specific attributes without adding many nullable columns to a relational table.

**3. What is a primary key?**
A column (or set of columns) that uniquely identifies each row and cannot be NULL.

**4. What is a foreign key?**
A constraint that enforces a valid relationship with a referenced table's primary/unique key.

**5. Why have a separate Courses table?**
A college may offer many courses. Keeping courses separate reduces repeated college data and allows posts to refer to a course consistently.

**6. What is normalization?**
Organizing relational data to reduce unnecessary duplication and update anomalies. This schema separates users, colleges, courses, posts and comments into related tables.

**7. What is a JOIN?**
It combines related rows across tables using a join condition. The posts report joins Posts → Courses → Colleges to show which college a post belongs to.

**8. Why LEFT JOIN in college reports?**
It retains colleges even when they have no matching course/post rows, allowing a count of zero to appear.

**9. What does GROUP BY do?**
It groups rows by selected columns so aggregate functions such as COUNT can calculate a value per college or topic.

**10. Why COUNT(DISTINCT ...) in the posts API?**
Joining both comments and likes can multiply rows (for example, 2 comments × 3 likes = 6 joined rows). DISTINCT prevents inflated counts.

**11. What is a MongoDB collection/document?**
A collection groups documents; each document is a BSON record with fields. Documents in a collection need not all have identical fields.

**12. How are SQL and NoSQL used together?**
The Express server connects to both. Post/comment/report routes query MySQL; review routes insert and read MongoDB documents.

**13. What is the novelty?**
The planned differentiator is a college experience comparison view based on student-submitted category ratings and counts. In this MVP, reviews are implemented; category-wise comparison aggregation is a next enhancement. Be honest about what is implemented versus planned.

**14. What are limitations?**
Demo IDs are fixed; there is no real authentication, moderation or production-grade access control. Review ratings are not yet aggregated into a comparison dashboard.

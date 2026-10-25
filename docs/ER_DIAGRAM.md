# CampusTalk ER Diagram

```mermaid
erDiagram
    USERS ||--o{ POSTS : creates
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ LIKES : gives
    USERS ||--o{ FOLLOWS : follows_as_follower
    USERS ||--o{ FOLLOWS : followed_by
    COLLEGES ||--o{ COURSES : offers
    COURSES ||--o{ POSTS : categorizes
    POSTS ||--o{ COMMENTS : has
    POSTS ||--o{ LIKES : receives

    USERS {
      int user_id PK
      varchar name
      varchar email UK
      enum role
      timestamp created_at
    }
    COLLEGES {
      int college_id PK
      varchar college_name UK
      varchar location
    }
    COURSES {
      int course_id PK
      int college_id FK
      varchar course_name
      varchar degree_level
    }
    POSTS {
      int post_id PK
      int user_id FK
      int course_id FK
      varchar title
      text content
      enum topic
      timestamp created_at
    }
    COMMENTS {
      int comment_id PK
      int post_id FK
      int user_id FK
      text content
      timestamp created_at
    }
    LIKES {
      int like_id PK
      int post_id FK
      int user_id FK
      timestamp created_at
    }
    FOLLOWS {
      int follower_id PK,FK
      int followed_user_id PK,FK
      timestamp created_at
    }
```

## NoSQL collection: `student_reviews` (MongoDB)
Each document contains `college_name`, `course_name`, `reviewer_name`, `category`, `rating`, `review_text`, and `created_at`. Optional fields can be added later (for example `hostel_type`, `placement_year`, or `club_name`) without altering a relational table schema.

require('dotenv').config();
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('--- Starting CampusTalk Seed Process ---');

  // 1. Connect to MySQL
  const sqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'campustalk',
    waitForConnections: true,
    connectionLimit: 10
  });

  // 2. Connect to MongoDB
  const mongoClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await mongoClient.connect();
  const mongoDb = mongoClient.db(process.env.MONGODB_DATABASE || 'campustalk');
  const reviewsCollection = mongoDb.collection('student_reviews');

  console.log('Connected to MySQL and MongoDB successfully.');

  // Password hash for all demo users: 'password123'
  const passwordHash = await bcrypt.hash('password123', 10);

  // 3. Seed Colleges
  const collegesData = [
    { name: 'PES University', location: 'Bengaluru', state: 'Karnataka', year: 1972, website: 'https://pes.edu' },
    { name: 'RV College of Engineering', location: 'Bengaluru', state: 'Karnataka', year: 1963, website: 'https://rvce.edu.in' },
    { name: 'BMS College of Engineering', location: 'Bengaluru', state: 'Karnataka', year: 1946, website: 'https://bmsce.ac.in' },
    { name: 'Pune Institute of Computer Technology', location: 'Pune', state: 'Maharashtra', year: 1983, website: 'https://pict.edu' },
    { name: 'College of Engineering Guindy', location: 'Chennai', state: 'Tamil Nadu', year: 1794, website: 'https://ceg.annauniv.edu' }
  ];

  for (const c of collegesData) {
    await sqlPool.execute(
      `INSERT INTO Colleges (college_name, location, state, established_year, website)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE location=VALUES(location), state=VALUES(state), established_year=VALUES(established_year), website=VALUES(website)`,
      [c.name, c.location, c.state, c.year, c.website]
    );
  }
  console.log('Seeded Colleges.');

  const [collegesRows] = await sqlPool.query('SELECT college_id, college_name FROM Colleges');
  const collegeMap = {};
  collegesRows.forEach(c => { collegeMap[c.college_name] = c.college_id; });

  // 4. Seed Courses
  const coursesData = [
    { college: 'PES University', name: 'B.Tech Computer Science and Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'PES University', name: 'B.Tech Artificial Intelligence & Machine Learning', degree: 'Undergraduate', dur: 4 },
    { college: 'PES University', name: 'B.Tech Electronics & Communication', degree: 'Undergraduate', dur: 4 },
    { college: 'PES University', name: 'M.Tech Software Engineering', degree: 'Postgraduate', dur: 2 },
    { college: 'RV College of Engineering', name: 'B.Tech Computer Science and Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'RV College of Engineering', name: 'B.Tech Information Science and Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'RV College of Engineering', name: 'B.Tech Electronics & Communication', degree: 'Undergraduate', dur: 4 },
    { college: 'BMS College of Engineering', name: 'B.Tech Computer Science and Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'BMS College of Engineering', name: 'B.Tech Mechanical Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'Pune Institute of Computer Technology', name: 'B.Tech Computer Engineering', degree: 'Undergraduate', dur: 4 },
    { college: 'Pune Institute of Computer Technology', name: 'B.Tech Information Technology', degree: 'Undergraduate', dur: 4 },
    { college: 'College of Engineering Guindy', name: 'B.Tech Computer Science and Engineering', degree: 'Undergraduate', dur: 4 }
  ];

  for (const cr of coursesData) {
    const colId = collegeMap[cr.college];
    if (colId) {
      await sqlPool.execute(
        `INSERT INTO Courses (college_id, course_name, degree_level, duration_years)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE degree_level=VALUES(degree_level), duration_years=VALUES(duration_years)`,
        [colId, cr.name, cr.degree, cr.dur]
      );
    }
  }
  console.log('Seeded Courses.');

  const [coursesRows] = await sqlPool.query('SELECT course_id, course_name, college_id FROM Courses');
  const courseMap = {};
  coursesRows.forEach(c => { courseMap[`${c.college_id}_${c.course_name}`] = c.course_id; });

  // 5. Seed Users
  const usersData = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.demo@campustalk.local',
      role: 'current_student',
      college: 'PES University',
      course: 'B.Tech Computer Science and Engineering',
      year: '3rd Year',
      bio: '3rd year CSE student at PES RR Campus. Passionate about systems programming, web architecture and open-source.',
      interests: 'Distributed Systems, Web Development, Competitive Programming'
    },
    {
      name: 'Meera Rao',
      email: 'meera.demo@campustalk.local',
      role: 'current_student',
      college: 'RV College of Engineering',
      course: 'B.Tech Information Science and Engineering',
      year: '4th Year',
      bio: 'Final year ISE student. Placed at Microsoft IDC. Glad to guide juniors on internships and placements.',
      interests: 'Cloud Computing, System Design, Career Mentorship'
    },
    {
      name: 'Rohan Verma',
      email: 'rohan.demo@campustalk.local',
      role: 'current_student',
      college: 'Pune Institute of Computer Technology',
      course: 'B.Tech Computer Engineering',
      year: '2nd Year',
      bio: '2nd year hosteler at PICT. Active member of ACM Student Chapter. Ask me about hostel life and academics!',
      interests: 'Algorithms, Hackathons, Campus Clubs'
    },
    {
      name: 'Sneha Patel',
      email: 'sneha.demo@campustalk.local',
      role: 'prospective_student',
      college: null,
      course: null,
      year: 'Prospective 2026',
      bio: 'Class 12 student exploring top engineering colleges in Karnataka & Maharashtra. Researching placements & hostels.',
      interests: 'Computer Science, AI, Campus Culture'
    },
    {
      name: 'Vikram Joshi',
      email: 'vikram.demo@campustalk.local',
      role: 'prospective_student',
      college: null,
      course: null,
      year: 'Prospective 2026',
      bio: 'JEE / KCET aspirant deciding between PES and RVCE for CS/IS branches.',
      interests: 'Admissions, Cutoffs, Return on Investment'
    },
    {
      name: 'Campus Admin',
      email: 'admin.demo@campustalk.local',
      role: 'admin',
      college: null,
      course: null,
      year: 'Staff',
      bio: 'Platform Administrator for CampusTalk. Ensuring healthy student discussions.',
      interests: 'Student Welfare, Platform Moderation'
    }
  ];

  for (const u of usersData) {
    const colId = u.college ? collegeMap[u.college] : null;
    const crsId = (colId && u.course) ? courseMap[`${colId}_${u.course}`] : null;
    await sqlPool.execute(
      `INSERT INTO Users (name, email, password_hash, role, college_id, course_id, academic_year, bio, interests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), password_hash=VALUES(password_hash), role=VALUES(role),
       college_id=VALUES(college_id), course_id=VALUES(course_id), academic_year=VALUES(academic_year),
       bio=VALUES(bio), interests=VALUES(interests)`,
      [u.name, u.email, passwordHash, u.role, colId, crsId, u.year, u.bio, u.interests]
    );
  }
  console.log('Seeded Users.');

  const [userRows] = await sqlPool.query('SELECT user_id, email FROM Users');
  const userMap = {};
  userRows.forEach(u => { userMap[u.email] = u.user_id; });

  // 6. Seed Discussions (Posts)
  const postsData = [
    {
      user: 'vikram.demo@campustalk.local',
      college: 'PES University',
      course: 'B.Tech Computer Science and Engineering',
      title: 'How manageable is the first-year academic workload at PES?',
      content: 'I have heard that PES has continuous internal evaluations (ISA exams) every few weeks. How intensive is the weekly assignment schedule, and do students get time for self-study and clubs?',
      topic: 'Academics',
      year: '1st Year'
    },
    {
      user: 'sneha.demo@campustalk.local',
      college: 'RV College of Engineering',
      course: 'B.Tech Information Science and Engineering',
      title: 'What are the realistic tier-1 placement statistics for ISE at RVCE?',
      content: 'Could any seniors share insights into product company visits (Google, Microsoft, Amazon, Atlassian) for ISE students? Do ISE students get equal opportunities as CSE students during campus drives?',
      topic: 'Placements',
      year: '4th Year'
    },
    {
      user: 'sneha.demo@campustalk.local',
      college: 'Pune Institute of Computer Technology',
      course: 'B.Tech Computer Engineering',
      title: 'How is the hostel accommodation, Wi-Fi, and mess food at PICT?',
      content: 'I will be moving from outside Maharashtra. Are first-year hostel seats easily available, and how strict are the curfew timings? Also, what is the mess food quality like?',
      topic: 'Hostels',
      year: '1st Year'
    },
    {
      user: 'aarav.demo@campustalk.local',
      college: 'PES University',
      course: 'B.Tech Computer Science and Engineering',
      title: 'Guide to joining technical clubs & hackathons at PES (ACM, IEEE, GDSC)',
      content: 'Starting college soon? Here is a breakdown of technical clubs at RR Campus. Recruitment usually starts in August with orientation and coding challenges. Feel free to ask club-specific questions below!',
      topic: 'Clubs',
      year: '3rd Year'
    },
    {
      user: 'vikram.demo@campustalk.local',
      college: 'BMS College of Engineering',
      course: 'B.Tech Computer Science and Engineering',
      title: 'Is the college location in Basavanagudi helpful for internships and city life?',
      content: 'Looking into BMSCE. How is the campus life and accessibility to tech parks in Bengaluru for 6-month final semester internships?',
      topic: 'Campus Life',
      year: '4th Year'
    },
    {
      user: 'sneha.demo@campustalk.local',
      college: 'College of Engineering Guindy',
      course: 'B.Tech Computer Science and Engineering',
      title: 'What is the cutoff rank and counseling process for other-state students at CEG?',
      content: 'Does CEG Chennai take other state admissions through JEE Main or direct Anna University counseling? What was last year general category closing rank?',
      topic: 'Admissions',
      year: 'Prospective'
    },
    // Unanswered Questions (Novel Feature)
    {
      user: 'vikram.demo@campustalk.local',
      college: 'PES University',
      course: 'B.Tech Artificial Intelligence & Machine Learning',
      title: 'How does AIML syllabus differ from core CSE at PES in 3rd & 4th year?',
      content: 'I want to know if AIML has enough math rigor (linear algebra, optimization) or if it covers mostly applied Python libraries. Any current AIML student please share thoughts!',
      topic: 'Academics',
      year: '3rd Year'
    },
    {
      user: 'sneha.demo@campustalk.local',
      college: 'RV College of Engineering',
      course: 'B.Tech Electronics & Communication',
      title: 'What core VLSI and embedded systems companies visit RVCE for ECE?',
      content: 'Curious whether Texas Instruments, Qualcomm, and Intel recruit specifically for hardware roles, and what GPA cutoff they typically require.',
      topic: 'Placements',
      year: '4th Year'
    },
    {
      user: 'vikram.demo@campustalk.local',
      college: 'BMS College of Engineering',
      course: 'B.Tech Mechanical Engineering',
      title: 'Are there active robotics and automotive clubs (Formula Student) in BMSCE?',
      content: 'Looking to get hands-on CAD and fabrication experience in mechanical engineering. How active are student racing teams here?',
      topic: 'Clubs',
      year: '2nd Year'
    }
  ];

  for (const p of postsData) {
    const userId = userMap[p.user];
    const colId = collegeMap[p.college];
    const crsId = courseMap[`${colId}_${p.course}`];
    if (userId && crsId) {
      await sqlPool.execute(
        `INSERT INTO Posts (user_id, course_id, title, content, topic, academic_year)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM Posts WHERE title = ?)`,
        [userId, crsId, p.title, p.content, p.topic, p.year, p.title]
      );
    }
  }
  console.log('Seeded Posts.');

  const [postsRows] = await sqlPool.query('SELECT post_id, title FROM Posts');
  const postMap = {};
  postsRows.forEach(p => { postMap[p.title] = p.post_id; });

  // 7. Seed Comments
  const commentsData = [
    {
      postTitle: 'How manageable is the first-year academic workload at PES?',
      user: 'aarav.demo@campustalk.local',
      content: 'The ISAs come fast, but professors give question banks and past papers. If you maintain 2-3 hours of consistent revision daily, it is completely manageable. Don’t leave lab records for the last day!'
    },
    {
      postTitle: 'How manageable is the first-year academic workload at PES?',
      user: 'meera.demo@campustalk.local',
      content: 'I agree with Aarav. The key is to form a study group early in 1st semester. Many students also participate in clubs on weekends.'
    },
    {
      postTitle: 'What are the realistic tier-1 placement statistics for ISE at RVCE?',
      user: 'meera.demo@campustalk.local',
      content: 'At RVCE, CSE and ISE sit for 99% of the exact same placement drives. Companies like Microsoft, Amazon, Cisco, and Morgan Stanley treat both equally. Average for our batch was around 16 LPA.'
    },
    {
      postTitle: 'How is the hostel accommodation, Wi-Fi, and mess food at PICT?',
      user: 'rohan.demo@campustalk.local',
      content: 'Hostel rooms are 3-sharing for 1st year with study tables and LAN connection. Mess food is decent Maharashtrian / North Indian style. Curfew is 9:30 PM for boys and 9:00 PM for girls.'
    },
    {
      postTitle: 'Guide to joining technical clubs & hackathons at PES (ACM, IEEE, GDSC)',
      user: 'rohan.demo@campustalk.local',
      content: 'Great guide! We did an inter-college hackathon with PES students last year, and the coding culture is genuinely competitive.'
    },
    {
      postTitle: 'Is the college location in Basavanagudi helpful for internships and city life?',
      user: 'aarav.demo@campustalk.local',
      content: 'Basavanagudi has green metro connectivity directly to Majestic and Whitefield / Electronic City tech corridors. Very convenient location compared to outer ring road colleges.'
    }
  ];

  for (const c of commentsData) {
    const postId = postMap[c.postTitle];
    const userId = userMap[c.user];
    if (postId && userId) {
      await sqlPool.execute(
        `INSERT INTO Comments (post_id, user_id, content)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM Comments WHERE post_id = ? AND user_id = ? AND content = ?)`,
        [postId, userId, c.content, postId, userId, c.content]
      );
    }
  }
  console.log('Seeded Comments.');

  // 8. Seed Likes
  const likesData = [
    { postTitle: 'How manageable is the first-year academic workload at PES?', user: 'meera.demo@campustalk.local' },
    { postTitle: 'How manageable is the first-year academic workload at PES?', user: 'rohan.demo@campustalk.local' },
    { postTitle: 'What are the realistic tier-1 placement statistics for ISE at RVCE?', user: 'aarav.demo@campustalk.local' },
    { postTitle: 'What are the realistic tier-1 placement statistics for ISE at RVCE?', user: 'vikram.demo@campustalk.local' },
    { postTitle: 'What are the realistic tier-1 placement statistics for ISE at RVCE?', user: 'sneha.demo@campustalk.local' },
    { postTitle: 'Guide to joining technical clubs & hackathons at PES (ACM, IEEE, GDSC)', user: 'meera.demo@campustalk.local' },
    { postTitle: 'Guide to joining technical clubs & hackathons at PES (ACM, IEEE, GDSC)', user: 'vikram.demo@campustalk.local' },
    { postTitle: 'How is the hostel accommodation, Wi-Fi, and mess food at PICT?', user: 'sneha.demo@campustalk.local' }
  ];

  for (const l of likesData) {
    const postId = postMap[l.postTitle];
    const userId = userMap[l.user];
    if (postId && userId) {
      await sqlPool.execute(
        `INSERT IGNORE INTO Likes (post_id, user_id) VALUES (?, ?)`,
        [postId, userId]
      );
    }
  }
  console.log('Seeded Likes.');

  // 9. Seed Follows
  const followsData = [
    { follower: 'vikram.demo@campustalk.local', followed: 'aarav.demo@campustalk.local' },
    { follower: 'sneha.demo@campustalk.local', followed: 'meera.demo@campustalk.local' },
    { follower: 'vikram.demo@campustalk.local', followed: 'meera.demo@campustalk.local' },
    { follower: 'aarav.demo@campustalk.local', followed: 'meera.demo@campustalk.local' }
  ];

  for (const f of followsData) {
    const fId = userMap[f.follower];
    const tId = userMap[f.followed];
    if (fId && tId) {
      await sqlPool.execute(
        `INSERT IGNORE INTO Follows (follower_id, followed_user_id) VALUES (?, ?)`,
        [fId, tId]
      );
    }
  }
  console.log('Seeded Follows.');

  // 10. Seed MongoDB Reviews
  await reviewsCollection.deleteMany({ seed: true });
  await reviewsCollection.createIndex({ college_name: 1, category: 1 });
  await reviewsCollection.createIndex({ college_id: 1, rating: -1 });
  await reviewsCollection.createIndex({ user_id: 1 });

  const reviewsData = [
    {
      seed: true,
      user_id: userMap['aarav.demo@campustalk.local'],
      reviewer_name: 'Aarav Sharma',
      user_role: 'current_student',
      college_id: collegeMap['PES University'],
      college_name: 'PES University',
      course_id: courseMap[`${collegeMap['PES University']}_B.Tech Computer Science and Engineering`],
      course_name: 'B.Tech Computer Science and Engineering',
      academic_year: '2023-2024',
      category: 'Academics',
      rating: 4,
      title: 'Rigorous curriculum that prepares you thoroughly for industry',
      review_text: 'The academic rigor at PES is unmatched in Bengaluru. The continuous assessment keeps you on your toes, and project evaluations are handled professionally.',
      pros: 'Excellent coding culture, modern computing labs, up-to-date syllabus with cloud & AI electives.',
      cons: 'Exams every 4-5 weeks leave little breathing room; attendance policy (85%) is strictly enforced.',
      advice_to_juniors: 'Build projects from semester 1 and take internal exams seriously.',
      helpful_count: 14,
      created_at: new Date('2026-08-15T10:00:00Z')
    },
    {
      seed: true,
      user_id: userMap['aarav.demo@campustalk.local'],
      reviewer_name: 'Aarav Sharma',
      user_role: 'current_student',
      college_id: collegeMap['PES University'],
      college_name: 'PES University',
      course_id: courseMap[`${collegeMap['PES University']}_B.Tech Computer Science and Engineering`],
      course_name: 'B.Tech Computer Science and Engineering',
      academic_year: '2023-2024',
      category: 'Placements',
      rating: 5,
      title: 'Tier-1 tech companies visit in large numbers',
      review_text: 'Almost all major tech companies (Apple, Microsoft, Google, Intuit, Cisco, Morgan Stanley) recruit on campus. Placement cell gives strong aptitude and interview training.',
      pros: 'Huge variety of dream and super-dream company offers, high median package for CSE.',
      cons: 'Heavy competition due to large batch size in CS/AIML branches.',
      advice_to_juniors: 'Focus heavily on Data Structures and competitive programming on LeetCode.',
      helpful_count: 22,
      created_at: new Date('2026-08-20T14:30:00Z')
    },
    {
      seed: true,
      user_id: userMap['meera.demo@campustalk.local'],
      reviewer_name: 'Meera Rao',
      user_role: 'current_student',
      college_id: collegeMap['RV College of Engineering'],
      college_name: 'RV College of Engineering',
      course_id: courseMap[`${collegeMap['RV College of Engineering']}_B.Tech Information Science and Engineering`],
      course_name: 'B.Tech Information Science and Engineering',
      academic_year: '2023-2024',
      category: 'Placements',
      rating: 5,
      title: 'Best placement brand value in South India',
      review_text: 'RVCE lives up to its reputation when it comes to placements. Companies respect the brand, and faculty in ISE are very supportive with recommendations.',
      pros: 'Top-tier average package, alumni network across Silicon Valley and Bengaluru.',
      cons: 'Campus is relatively compact compared to older universities.',
      advice_to_juniors: 'Keep your CGPA above 8.5 to be eligible for all super-dream test rounds.',
      helpful_count: 19,
      created_at: new Date('2026-09-02T11:15:00Z')
    },
    {
      seed: true,
      user_id: userMap['meera.demo@campustalk.local'],
      reviewer_name: 'Meera Rao',
      user_role: 'current_student',
      college_id: collegeMap['RV College of Engineering'],
      college_name: 'RV College of Engineering',
      course_id: courseMap[`${collegeMap['RV College of Engineering']}_B.Tech Information Science and Engineering`],
      course_name: 'B.Tech Information Science and Engineering',
      academic_year: '2023-2024',
      category: 'Campus Life',
      rating: 4,
      title: '8th Mile cultural fest is legendary; balanced college vibe',
      review_text: 'Life at RVCE is a healthy balance between study and fun. The clubs (Rotaract, Raag, Astra Robotics) are student-run with great funding.',
      pros: 'Vibrant club ecosystem, friendly peer group, good sports facilities.',
      cons: 'Basavanagudi/Mysore road traffic during evening commute.',
      advice_to_juniors: 'Join at least one cultural and one technical club in your first year.',
      helpful_count: 11,
      created_at: new Date('2026-09-10T16:45:00Z')
    },
    {
      seed: true,
      user_id: userMap['rohan.demo@campustalk.local'],
      reviewer_name: 'Rohan Verma',
      user_role: 'current_student',
      college_id: collegeMap['Pune Institute of Computer Technology'],
      college_name: 'Pune Institute of Computer Technology',
      course_id: courseMap[`${collegeMap['Pune Institute of Computer Technology']}_B.Tech Computer Engineering`],
      course_name: 'B.Tech Computer Engineering',
      academic_year: '2023-2024',
      category: 'Hostels',
      rating: 3,
      title: 'Functional hostels with strict discipline',
      review_text: 'The hostel rooms are clean and equipped with good internet, but rules are strictly monitored by wardens. Mess food is decent vegetarian food.',
      pros: 'Safe campus, walking distance to academic blocks, reliable Wi-Fi.',
      cons: 'Strict curfew timings and guest restrictions.',
      advice_to_juniors: 'Apply early as hostel seats are allocated strictly on merit rank.',
      helpful_count: 8,
      created_at: new Date('2026-09-15T09:20:00Z')
    },
    {
      seed: true,
      user_id: userMap['rohan.demo@campustalk.local'],
      reviewer_name: 'Rohan Verma',
      user_role: 'current_student',
      college_id: collegeMap['Pune Institute of Computer Technology'],
      college_name: 'Pune Institute of Computer Technology',
      course_id: courseMap[`${collegeMap['Pune Institute of Computer Technology']}_B.Tech Computer Engineering`],
      course_name: 'B.Tech Computer Engineering',
      academic_year: '2023-2024',
      category: 'Academics',
      rating: 5,
      title: 'The coding Mecca of Pune; unbeatable peer group',
      review_text: 'If your goal is competitive programming, algorithmic depth, and getting into top software engineering roles in Pune/Bangalore, PICT is phenomenal.',
      pros: 'Incredible peer group where everyone is grinding DSA, strong alumni network.',
      cons: 'Campus is small with limited sports grounds.',
      advice_to_juniors: 'Get involved in ACM chapter and Pulzion techfest from year one.',
      helpful_count: 27,
      created_at: new Date('2026-09-25T13:00:00Z')
    },
    {
      seed: true,
      user_id: userMap['aarav.demo@campustalk.local'],
      reviewer_name: 'Aarav Sharma',
      user_role: 'current_student',
      college_id: collegeMap['BMS College of Engineering'],
      college_name: 'BMS College of Engineering',
      course_id: courseMap[`${collegeMap['BMS College of Engineering']}_B.Tech Computer Science and Engineering`],
      course_name: 'B.Tech Computer Science and Engineering',
      academic_year: '2023-2024',
      category: 'Fees & ROI',
      rating: 4,
      title: 'Solid return on investment through KCET admission',
      review_text: 'KCET government quota fees are very reasonable for the quality of faculty, placement records, and campus location in Basavanagudi.',
      pros: 'Affordable fee structure via KCET, high placement return, beautiful heritage campus.',
      cons: 'Management quota fees are high.',
      advice_to_juniors: 'Aim for top rank in state CET for affordable tier-1 engineering.',
      helpful_count: 15,
      created_at: new Date('2026-10-01T15:10:00Z')
    }
  ];

  await reviewsCollection.insertMany(reviewsData);
  console.log(`Seeded ${reviewsData.length} MongoDB review documents.`);

  await sqlPool.end();
  await mongoClient.close();
  console.log('--- CampusTalk Seed Completed Successfully ---');
}

seed().catch(err => {
  console.error('Seed script encountered an error:', err);
  process.exit(1);
});

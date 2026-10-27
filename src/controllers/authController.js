const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSqlPool } = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res) {
  const { name, email, password, role, college_id, course_id, academic_year, bio, interests } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({ error: 'Name must be between 2 and 100 characters.' });
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const validRoles = ['prospective_student', 'current_student'];
  const userRole = validRoles.includes(role) ? role : 'prospective_student';

  const pool = getSqlPool();

  try {
    // Check existing email
    const [existing] = await pool.execute('SELECT user_id FROM Users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const colId = college_id ? Number(college_id) : null;
    const crsId = course_id ? Number(course_id) : null;

    const [result] = await pool.execute(
      `INSERT INTO Users (name, email, password_hash, role, college_id, course_id, academic_year, bio, interests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        email.trim().toLowerCase(),
        passwordHash,
        userRole,
        colId,
        crsId,
        academic_year ? String(academic_year).trim() : null,
        bio ? String(bio).trim() : null,
        interests ? String(interests).trim() : null
      ]
    );

    const userId = result.insertId;

    // Fetch college and course names if linked
    let collegeName = null;
    let courseName = null;
    if (colId) {
      const [col] = await pool.execute('SELECT college_name FROM Colleges WHERE college_id = ?', [colId]);
      if (col.length) collegeName = col[0].college_name;
    }
    if (crsId) {
      const [crs] = await pool.execute('SELECT course_name FROM Courses WHERE course_id = ?', [crsId]);
      if (crs.length) courseName = crs[0].course_name;
    }

    const userPayload = {
      user_id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: userRole,
      college_id: colId,
      college_name: collegeName,
      course_id: crsId,
      course_name: courseName,
      academic_year: academic_year ? String(academic_year).trim() : null,
      bio: bio ? String(bio).trim() : null,
      interests: interests ? String(interests).trim() : null
    };

    const token = jwt.sign(
      { user_id: userId, email: userPayload.email, role: userRole, name: userPayload.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account registered successfully',
      token,
      user: userPayload
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'An error occurred during registration. Please try again.' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const pool = getSqlPool();

  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.name, u.email, u.password_hash, u.role, u.college_id, u.course_id,
              u.academic_year, u.bio, u.interests, cl.college_name, cr.course_name
       FROM Users u
       LEFT JOIN Colleges cl ON cl.college_id = u.college_id
       LEFT JOIN Courses cr ON cr.course_id = u.course_id
       WHERE u.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      college_id: user.college_id,
      college_name: user.college_name,
      course_id: user.course_id,
      course_name: user.course_name,
      academic_year: user.academic_year,
      bio: user.bio,
      interests: user.interests
    };

    return res.json({
      message: 'Signed in successfully',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An error occurred during login. Please try again.' });
  }
}

async function getProfile(req, res) {
  const pool = getSqlPool();

  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.name, u.email, u.role, u.college_id, u.course_id,
              u.academic_year, u.bio, u.interests, u.created_at,
              cl.college_name, cr.course_name,
              COUNT(DISTINCT p.post_id) AS posts_count,
              COUNT(DISTINCT cm.comment_id) AS comments_count
       FROM Users u
       LEFT JOIN Colleges cl ON cl.college_id = u.college_id
       LEFT JOIN Courses cr ON cr.course_id = u.course_id
       LEFT JOIN Posts p ON p.user_id = u.user_id
       LEFT JOIN Comments cm ON cm.user_id = u.user_id
       WHERE u.user_id = ?
       GROUP BY u.user_id`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('GetProfile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
}

async function updateProfile(req, res) {
  const { name, college_id, course_id, academic_year, bio, interests } = req.body;
  const pool = getSqlPool();

  try {
    const updates = [];
    const params = [];

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (college_id !== undefined) {
      updates.push('college_id = ?');
      params.push(college_id ? Number(college_id) : null);
    }
    if (course_id !== undefined) {
      updates.push('course_id = ?');
      params.push(course_id ? Number(course_id) : null);
    }
    if (academic_year !== undefined) {
      updates.push('academic_year = ?');
      params.push(academic_year ? String(academic_year).trim() : null);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(bio ? String(bio).trim() : null);
    }
    if (interests !== undefined) {
      updates.push('interests = ?');
      params.push(interests ? String(interests).trim() : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    params.push(req.user.user_id);
    await pool.execute(`UPDATE Users SET ${updates.join(', ')} WHERE user_id = ?`, params);

    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};

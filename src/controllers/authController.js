const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

exports.register = async (req, res) => {
  const { username, email, password, language, country } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, language, country) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email',
      [username, email, hashedPassword, language, country]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(201).json({ user, token });
  } catch (error) {
    logger.error('Error in user registration:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    res.json({ user: { id: user.user_id, username: user.username, email: user.email }, token });
  } catch (error) {
    logger.error('Error in user login:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
};

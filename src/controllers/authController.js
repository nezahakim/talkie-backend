const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

// exports.register = async (req, res) => {
//   const { username, email, password, language, country } = req.body;

//   try {
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const result = await pool.query(
//       "INSERT INTO users (username, email, password_hash, language, country) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email",
//       [username, email, hashedPassword, language, country],
//     );

//     const user = result.rows[0];
//     const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
//       expiresIn: "1d",
//     });

//     res.status(201).json({ user, token });
//   } catch (error) {
//     logger.error("Error in user registration:", error);
//     res.status(500).json({ message: "Error registering user" });
//   }
// };

exports.register = async (req, res) => {
  const {
    username,
    email,
    password,
    language,
    country,
    fullName,
    bio,
    hashtags,
    websiteUrl,
    socialMediaLinks,
    preferences,
  } = req.body;

  try {
    await pool.query("BEGIN");
    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, language, country)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, username, email`,
      [username, email, hashedPassword, language, country],
    );

    const user = userResult.rows[0];

    await pool.query(
      `INSERT INTO accounts (user_id, full_name, bio, hashtags, website_url, social_media_links, preferences)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.user_id,
        fullName,
        bio,
        hashtags,
        websiteUrl,
        JSON.stringify(socialMediaLinks),
        JSON.stringify(preferences),
      ],
    );

    await pool.query("COMMIT");
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName,
        bio,
        hashtags,
        websiteUrl,
        socialMediaLinks,
        preferences,
        language,
        country,
      },
      token,
    });
  } catch (error) {
    await pool.query("ROLLBACK");
    logger.error("Error in user registration:", error);

    if (error.constraint === "users_username_key") {
      return res.status(409).json({ message: "Username already exists" });
    }
    if (error.constraint === "users_email_key") {
      return res.status(409).json({ message: "Email already exists" });
    }

    res.status(500).json({ message: "Error registering user" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    await pool.query(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1",
      [user.user_id],
    );

    res.json({
      user: { id: user.user_id, username: user.username, email: user.email },
      token,
    });
  } catch (error) {
    logger.error("Error in user login:", error);
    res.status(500).json({ message: "Error logging in" });
  }
};

const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

exports.getUserProfileByUsername = async (req, res) => {
  try {
    const username = req.params.username;
    const query = `SELECT
    u.user_id,
    u.username,
    u.email,
    u.profile_picture,
    u.language,
    u.country,
    u.created_at,

    -- Account Information
    a.full_name,
    a.bio,
    a.hashtags,
    a.website_url,
    a.social_media_links,
    a.preferences,

    -- Statistics
    COUNT(DISTINCT ls.session_id) AS total_live_rooms_created,
    COUNT(DISTINCT p.user_id) AS total_listeners
  FROM
    users u
  LEFT JOIN
    accounts a ON u.user_id = a.user_id  -- Joining account details
  LEFT JOIN
    live_sessions ls ON u.user_id = ls.host_user_id  -- Counting live rooms created
  LEFT JOIN
    participants p ON ls.session_id = p.session_id   -- Counting distinct listeners
  WHERE
    u.username = $1
  GROUP BY
    u.user_id, a.full_name, a.bio, a.hashtags, a.website_url, a.social_media_links, a.preferences;
  `;

    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    res.json(user);
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
};

exports.getUserByUserId = async (req, res) => {
  try {
    const user_id = req.params.user_id;
    const query = `SELECT
    u.user_id,
    u.username,
    u.email,
    u.profile_picture,
    u.language,
    u.country,
    u.created_at,

    -- Account Information
    a.full_name,
    a.bio,
    a.hashtags,
    a.website_url,
    a.social_media_links,
    a.preferences,

    -- Statistics
    COUNT(DISTINCT ls.session_id) AS total_live_rooms_created,
    COUNT(DISTINCT p.user_id) AS total_listeners
  FROM
    users u
  LEFT JOIN
    accounts a ON u.user_id = a.user_id  -- Joining account details
  LEFT JOIN
    live_sessions ls ON u.user_id = ls.host_user_id  -- Counting live rooms created
  LEFT JOIN
    participants p ON ls.session_id = p.session_id   -- Counting distinct listeners
  WHERE
    u.user_id = $1
  GROUP BY
    u.user_id, a.full_name, a.bio, a.hashtags, a.website_url, a.social_media_links, a.preferences;
  `;

    const result = await pool.query(query, [user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    res.json(user);
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
};

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const query = `SELECT 
  u.user_id, 
  u.username, 
  u.email, 
  u.profile_picture, 
  u.language, 
  u.country, 
  u.created_at,
  
  -- Account Information
  a.full_name, 
  a.bio, 
  a.hashtags, 
  a.website_url, 
  a.social_media_links, 
  a.preferences,
  
  -- Statistics
  COUNT(DISTINCT ls.session_id) AS total_live_rooms_created,
  COUNT(DISTINCT p.user_id) AS total_listeners
FROM 
  users u
LEFT JOIN 
  accounts a ON u.user_id = a.user_id  -- Joining account details
LEFT JOIN 
  live_sessions ls ON u.user_id = ls.host_user_id  -- Counting live rooms created
LEFT JOIN 
  participants p ON ls.session_id = p.session_id   -- Counting distinct listeners
WHERE 
  u.user_id = $1
GROUP BY 
  u.user_id, a.full_name, a.bio, a.hashtags, a.website_url, a.social_media_links, a.preferences;
`;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    res.json(user);
  } catch (error) {
    logger.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
};

exports.updateUserProfile = async (req, res) => {
  const { username, language, country, bio } = req.body;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      "UPDATE users SET username = $1, language = $2, country = $3, bio = $4 WHERE user_id = $5 RETURNING *",
      [username, language, country, bio, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error updating user profile:", error);
    res.status(500).json({ message: "Error updating user profile" });
  }
};

exports.followUser = async (req, res) => {
  const followerId = req.user.userId;
  const { userId } = req.params;

  try {
    await pool.query(
      "INSERT INTO followers (user_id, follower_user_id) VALUES ($1, $2)",
      [userId, followerId],
    );
    res.status(201).json({ message: "User followed successfully" });
  } catch (error) {
    logger.error("Error following user:", error);
    res.status(500).json({ message: "Error following user" });
  }
};

exports.unfollowUser = async (req, res) => {
  const followerId = req.user.userId;
  const { userId } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM followers WHERE user_id = $1 AND follower_user_id = $2",
      [userId, followerId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Follow relationship not found" });
    }

    res.json({ message: "User unfollowed successfully" });
  } catch (error) {
    logger.error("Error unfollowing user:", error);
    res.status(500).json({ message: "Error unfollowing user" });
  }
};

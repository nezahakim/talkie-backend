const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await pool.query(
      `
      SELECT u.user_id, u.username, u.email, u.profile_picture, u.language, u.country, u.created_at,
             COUNT(DISTINCT f.follower_user_id) AS followers_count,
             COUNT(DISTINCT f2.user_id) AS following_count,
             COALESCE(SUM(EXTRACT(EPOCH FROM (p.left_at - p.joined_at)) / 3600), 0) AS total_listening_hours
      FROM users u
      LEFT JOIN followers f ON u.user_id = f.user_id
      LEFT JOIN followers f2 ON u.user_id = f2.follower_user_id
      LEFT JOIN participants p ON u.user_id = p.user_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `,
      [userId],
    );

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

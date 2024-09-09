const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  followUser,
  unfollowUser,
} = require("../controllers/userController");
const auth = require("../middleware/auth");
const router = express.Router();

router.get("/profile/:username", async (req, res) => {
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
});
router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateUserProfile);
router.post("/follow/:userId", auth, followUser);
router.delete("/unfollow/:userId", auth, unfollowUser);

module.exports = router;

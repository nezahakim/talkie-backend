const express = require("express");
const {
  getUserProfile,
  updateUserProfile,
  followUser,
  unfollowUser,
  getUserProfileByUsername,
  getUserByUserId,
} = require("../controllers/userController");
const auth = require("../middleware/auth");
const router = express.Router();

router.get("/profile/:username", getUserProfileByUsername);
router.get("/user_id/:user_id", getUserByUserId);
router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateUserProfile);
router.post("/follow/:userId", auth, followUser);
router.delete("/unfollow/:userId", auth, unfollowUser);

module.exports = router;

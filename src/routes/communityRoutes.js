const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  createCommunity,
  getCommunityDetails,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  updateMemberRole,
  getAllComminties,
} = require("../controllers/communityController");

// Create a new community
router.post("/", auth, createCommunity);
router.get("/", auth, getAllComminties);

// Get community details
router.get("/:communityId", auth, getCommunityDetails);

// Update community details
router.put("/:communityId", auth, updateCommunity);

// Delete a community
router.delete("/:communityId", auth, deleteCommunity);

// Join a community
router.post("/:communityId/join", auth, joinCommunity);

// Leave a community
router.post("/:communityId/leave", auth, leaveCommunity);

// Get community members
router.get("/:communityId/members", auth, getCommunityMembers);

// Update member role
router.put("/:communityId/members/:userId/role", auth, updateMemberRole);

module.exports = router;

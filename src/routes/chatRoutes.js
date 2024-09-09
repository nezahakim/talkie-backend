const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const chatController = require("../controllers/chatController");

router.get("/", auth, chatController.getAllChats);
router.get("/:chatId/messages", auth, chatController.getChatMessages);
router.post("/:chatId/messages", auth, chatController.sendMessage);
router.delete(
  "/:chatId/messages/:messageId",
  auth,
  chatController.deleteMessage,
);
router.post("/private", auth, chatController.createPrivateChat);
router.get("/community", auth, chatController.getCommunityChats);
router.post(
  "/community/:communityId/join",
  auth,
  chatController.joinCommunityChat,
);
router.post(
  "/community/:communityId/leave",
  auth,
  chatController.leaveCommunityChat,
);
router.post(
  "/:chatId/messages/:messageId/pin",
  auth,
  chatController.pinMessage,
);
router.post(
  "/:chatId/messages/:messageId/unpin",
  auth,
  chatController.unpinMessage,
);

module.exports = router;

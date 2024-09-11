const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

// const chatController = require("../controllers/chatController");

const setupChatSocketIO = (io) => {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.user.userId}`);

    // Join user to their chat rooms
    joinUserRooms(socket);

    socket.on("listAllChats", async (data) => {
      const { chatId } = data;
      const limit = 50;
      const offset = 0;
      const userId = socket.user.userId;

      try {
        // Check if user is a participant in the chat
        const participantCheck = await pool.query(
          "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
          [chatId, userId],
        );

        if (participantCheck.rows.length === 0) {
          console.log("You do not have access to this chat");
        }

        const result = await pool.query(
          `
          SELECT 
              cm.message_id, 
              cm.user_id, 
              u.username, 
              u.profile_picture, 
              a.full_name,           -- Adding the user's name from the accounts table
              cm.message, 
              cm.pinned, 
              cm.created_at
          FROM 
              chat_messages cm
          JOIN 
              users u ON cm.user_id = u.user_id
          JOIN 
              accounts a ON u.user_id = a.user_id   -- Join with accounts table to get the name
          WHERE 
              cm.chat_id = $1
          ORDER BY 
              cm.created_at ASC
          LIMIT 
              $2 
          OFFSET 
              $3;

        `,
          [chatId, limit, offset],
        );

        // console.log(result.rows)
        // Emit message to a user in the chat room
        io.to(socket.id).emit("ListAllChats", result.rows);
      } catch (error) {
        logger.error("Error fetching chat messages:", error);
      }
    });

    // Handle new messages
    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, message } = data;
        const userId = socket.user.userId;

        // Save message to database
        const result = await pool.query(
          "INSERT INTO chat_messages (chat_id, user_id, message) VALUES ($1, $2, $3) RETURNING *",
          [chatId, userId, message],
        );

        const newMessage = result.rows[0];

        const result0 = await pool.query(
          `
          SELECT cm.message_id, cm.user_id, u.username, u.profile_picture, cm.message, cm.pinned, cm.created_at
          FROM chat_messages cm
          JOIN users u ON cm.user_id = u.user_id
          WHERE cm.chat_id = $1 AND cm.message_id = $2
        `,
          [chatId, newMessage.message_id],
        );

        // Emit message to all users in the chat room
        io.to(chatId).emit("newMessage", result0.rows[0]);
      } catch (error) {
        logger.error("Error sending message:", error);
        socket.emit("error", { message: "Error sending message" });
      }
    });

    // Handle deleting messages
    socket.on("deleteMessage", async (data) => {
      try {
        const { chatId, messageId } = data;
        const userId = socket.user.userId;

        // Check if user has permission to delete the message
        const messageCheck = await pool.query(
          `SELECT cm.user_id, c.chat_type
           FROM chat_messages cm
           JOIN chats c ON cm.chat_id = c.chat_id
           LEFT JOIN community_memberships cmm ON c.chat_type = 'community' AND c.chat_id = cmm.community_id AND cmm.user_id = $1
           WHERE cm.message_id = $2 AND cm.chat_id = $3`,
          [userId, messageId, chatId],
        );

        if (messageCheck.rows.length === 0) {
          return socket.emit("error", { message: "Message not found" });
        }

        const { user_id, chat_type } = messageCheck.rows[0];
        const isAdmin =
          chat_type === "community" && messageCheck.rows[0].role === "admin";

        if (user_id !== userId && !isAdmin) {
          return socket.emit("error", {
            message: "You do not have permission to delete this message",
          });
        }

        // Delete the message
        await pool.query("DELETE FROM chat_messages WHERE message_id = $1", [
          messageId,
        ]);

        // Notify all users in the chat room about the deleted message
        io.to(chatId).emit("messageDeleted", { messageId });
      } catch (error) {
        logger.error("Error deleting message:", error);
        socket.emit("error", { message: "Error deleting message" });
      }
    });

    // Handle pinning messages
    socket.on("pinMessage", async (data) => {
      try {
        const { chatId, messageId } = data;
        const userId = socket.user.userId;

        // Check if user has permission to pin the message
        const userCheck = await pool.query(
          `SELECT c.chat_type, 
                 CASE WHEN c.chat_type = 'community' THEN cm.role ELSE 'participant' END AS user_role
          FROM chats c
          LEFT JOIN community_memberships cm ON c.chat_id = cm.community_id AND cm.user_id = $1
          JOIN chat_participants cp ON c.chat_id = cp.chat_id AND cp.user_id = $1
          WHERE c.chat_id = $2`,
          [userId, chatId],
        );

        if (userCheck.rows.length === 0) {
          return socket.emit("error", {
            message: "You do not have access to this chat",
          });
        }

        const { chat_type, user_role } = userCheck.rows[0];

        if (chat_type === "community" && user_role !== "admin") {
          return socket.emit("error", {
            message: "Only admins can pin messages in community chats",
          });
        }

        // Pin the message
        const result = await pool.query(
          "UPDATE chat_messages SET pinned = true WHERE message_id = $1 AND chat_id = $2 RETURNING *",
          [messageId, chatId],
        );

        if (result.rows.length === 0) {
          return socket.emit("error", { message: "Message not found" });
        }

        // Notify all users in the chat room about the pinned message
        io.to(chatId).emit("messagePinned", result.rows[0]);
      } catch (error) {
        logger.error("Error pinning message:", error);
        socket.emit("error", { message: "Error pinning message" });
      }
    });

    // Handle unpinning messages
    socket.on("unpinMessage", async (data) => {
      try {
        const { chatId, messageId } = data;
        const userId = socket.user.userId;

        // Check if user has permission to unpin the message
        const userCheck = await pool.query(
          `SELECT c.chat_type, 
                 CASE WHEN c.chat_type = 'community' THEN cm.role ELSE 'participant' END AS user_role
          FROM chats c
          LEFT JOIN community_memberships cm ON c.chat_id = cm.community_id AND cm.user_id = $1
          JOIN chat_participants cp ON c.chat_id = cp.chat_id AND cp.user_id = $1
          WHERE c.chat_id = $2`,
          [userId, chatId],
        );

        if (userCheck.rows.length === 0) {
          return socket.emit("error", {
            message: "You do not have access to this chat",
          });
        }

        const { chat_type, user_role } = userCheck.rows[0];

        if (chat_type === "community" && user_role !== "admin") {
          return socket.emit("error", {
            message: "Only admins can unpin messages in community chats",
          });
        }

        // Unpin the message
        const result = await pool.query(
          "UPDATE chat_messages SET pinned = false WHERE message_id = $1 AND chat_id = $2 RETURNING *",
          [messageId, chatId],
        );

        if (result.rows.length === 0) {
          return socket.emit("error", { message: "Message not found" });
        }

        // Notify all users in the chat room about the unpinned message
        io.to(chatId).emit("messageUnpinned", result.rows[0]);
      } catch (error) {
        logger.error("Error unpinning message:", error);
        socket.emit("error", { message: "Error unpinning message" });
      }
    });

    // Handle joining a community chat
    socket.on("joinCommunityChat", async (data) => {
      try {
        const { communityId } = data;
        const userId = socket.user.userId;

        // Check if the user is already a member of the community
        const memberCheck = await pool.query(
          "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
          [communityId, userId],
        );

        if (memberCheck.rows.length > 0) {
          return socket.emit("error", {
            message: "You are already a member of this community chat",
          });
        }

        // Add user to the community chat
        await pool.query(
          "INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)",
          [communityId, userId],
        );

        // Join the socket to the community chat room
        socket.join(communityId);

        // Notify the user that they've joined successfully
        socket.emit("joinedCommunityChat", { communityId });

        // Notify other users in the community chat
        socket.to(communityId).emit("userJoinedChat", { userId, communityId });
      } catch (error) {
        logger.error("Error joining community chat:", error);
        socket.emit("error", { message: "Error joining community chat" });
      }
    });

    // Handle leaving a community chat
    socket.on("leaveCommunityChat", async (data) => {
      try {
        const { communityId } = data;
        const userId = socket.user.userId;

        const result = await pool.query(
          "DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
          [communityId, userId],
        );

        if (result.rowCount === 0) {
          return socket.emit("error", {
            message: "You are not a member of this community chat",
          });
        }

        // Remove the socket from the community chat room
        socket.leave(communityId);

        // Notify the user that they've left successfully
        socket.emit("leftCommunityChat", { communityId });

        // Notify other users in the community chat
        socket.to(communityId).emit("userLeftChat", { userId, communityId });
      } catch (error) {
        logger.error("Error leaving community chat:", error);
        socket.emit("error", { message: "Error leaving community chat" });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${socket.user.userId}`);
    });
  });
};

// Helper function to join user to their chat rooms
const joinUserRooms = async (socket) => {
  try {
    const userId = socket.user.userId;
    const result = await pool.query(
      "SELECT chat_id FROM chat_participants WHERE user_id = $1",
      [userId],
    );
    result.rows.forEach((row) => {
      socket.join(row.chat_id);
    });
  } catch (error) {
    logger.error("Error joining user rooms:", error);
  }
};

module.exports = setupChatSocketIO;

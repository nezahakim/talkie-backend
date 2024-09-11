const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

exports.getAllChats = async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `SELECT
        c.chat_id,
        c.chat_type,
        c.created_at,
        CASE
            WHEN c.chat_type = 'private' THEN acc.full_name
            WHEN c.chat_type = 'community' THEN comm.name
            ELSE 'Unknown'
        END AS chat_name,
        CASE
            WHEN c.chat_type = 'private' THEN u.profile_picture
            ELSE NULL
        END AS chat_icon,
        cm.message AS last_message,
        cm.created_at AS last_message_time
    FROM chats c
    LEFT JOIN chat_participants cp
        ON c.chat_id = cp.chat_id
    LEFT JOIN users u
        ON c.chat_type = 'private'
        AND cp.user_id != $1
        AND cp.user_id = u.user_id
    LEFT JOIN accounts acc
        ON u.user_id = acc.user_id -- Use full_name from the accounts table
    LEFT JOIN community comm
        ON c.chat_type = 'community'
        AND c.chat_id = comm.community_id
    LEFT JOIN (
        SELECT chat_id, message, created_at
        FROM chat_messages
        WHERE (chat_id, created_at) IN (
            SELECT chat_id, MAX(created_at)
            FROM chat_messages
            GROUP BY chat_id
        )
    ) cm
        ON c.chat_id = cm.chat_id
    WHERE cp.user_id = $1
       OR comm.created_by = $1
    GROUP BY c.chat_id, c.chat_type, acc.full_name, comm.name, u.profile_picture, cm.message, cm.created_at
    ORDER BY COALESCE(cm.created_at, c.created_at) DESC;
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      console.log("No chats or communities found for user:", userId);

      // Let's check if the user exists and has created any communities
      const userCheck = await pool.query(
        "SELECT * FROM users WHERE user_id = $1",
        [userId],
      );

      if (userCheck.rows.length === 0) {
        console.log("User not found:", userId);
        return res.status(404).json({ message: "User not found" });
      }

      const communityCheck = await pool.query(
        "SELECT * FROM community WHERE created_by = $1",
        [userId],
      );

      console.log(`User has created ${communityCheck.rows.length} communities`);

      return res.json([]);
    }

    console.log(
      `Found ${result.rows.length} chats/communities for user:`,
      userId,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching all chats:", error);
    res
      .status(500)
      .json({ message: "Error fetching all chats", error: error.message });
  }
};

exports.getChatMessages = async (req, res) => {
  const { chatId } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  const userId = req.user.userId;

  try {
    // Check if user is a participant in the chat
    const participantCheck = await pool.query(
      "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
      [chatId, userId],
    );

    if (participantCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this chat" });
    }

    const result = await pool.query(
      `
      SELECT cm.message_id, cm.user_id, u.username, u.profile_picture, cm.message, cm.pinned, cm.created_at
      FROM chat_messages cm
      JOIN users u ON cm.user_id = u.user_id
      WHERE cm.chat_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [chatId, limit, offset],
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Error fetching chat messages:", error);
    res.status(500).json({ message: "Error fetching chat messages" });
  }
};

exports.sendMessage = async (req, res) => {
  const { chatId } = req.params;
  const { message } = req.body;
  const userId = req.user.userId;

  try {
    // Check if user is a participant in the chat
    const participantCheck = await pool.query(
      "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
      [chatId, userId],
    );

    if (participantCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this chat" });
    }

    const result = await pool.query(
      `
      INSERT INTO chat_messages (chat_id, user_id, message)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [chatId, userId, message],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error("Error sending message:", error);
    res.status(500).json({ message: "Error sending message" });
  }
};

exports.deleteMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user is the message author or an admin
    const messageCheck = await pool.query(
      `
      SELECT cm.user_id, c.chat_type
      FROM chat_messages cm
      JOIN chats c ON cm.chat_id = c.chat_id
      LEFT JOIN community_memberships cmm ON c.chat_type = 'community' AND c.chat_id = cmm.community_id AND cmm.user_id = $1
      WHERE cm.message_id = $2 AND cm.chat_id = $3
    `,
      [userId, messageId, chatId],
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    const { user_id, chat_type } = messageCheck.rows[0];
    const isAdmin =
      chat_type === "community" && messageCheck.rows[0].role === "admin";

    if (user_id !== userId && !isAdmin) {
      return res
        .status(403)
        .json({ message: "You do not have permission to delete this message" });
    }

    await pool.query("DELETE FROM chat_messages WHERE message_id = $1", [
      messageId,
    ]);

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    logger.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message" });
  }
};

exports.createPrivateChat = async (req, res) => {
  const { userId: otherUserId } = req.body;
  const userId = req.user.userId;

  try {
    // Check if a private chat already exists between these users
    const existingChat = await pool.query(
      `
      SELECT c.chat_id
      FROM chats c
      JOIN chat_participants cp1 ON c.chat_id = cp1.chat_id
      JOIN chat_participants cp2 ON c.chat_id = cp2.chat_id
      WHERE c.chat_type = 'private'
        AND cp1.user_id = $1
        AND cp2.user_id = $2
    `,
      [userId, otherUserId],
    );

    if (existingChat.rows.length > 0) {
      return res.json({ chatId: existingChat.rows[0].chat_id });
    }

    // Create a new private chat
    const result = await pool.query(
      `
      WITH new_chat AS (
        INSERT INTO chats (chat_type) VALUES ('private') RETURNING chat_id
      )
      INSERT INTO chat_participants (chat_id, user_id)
      SELECT chat_id, unnest(ARRAY[$1, $2])
      FROM new_chat
      RETURNING chat_id
    `,
      [userId, otherUserId],
    );

    res.status(201).json({ chatId: result.rows[0].chat_id });
  } catch (error) {
    logger.error("Error creating private chat:", error);
    res.status(500).json({ message: "Error creating private chat" });
  }
};

exports.getCommunityChats = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      SELECT c.chat_id, comm.name AS chat_name, c.created_at,
             cm.message AS last_message, cm.created_at AS last_message_time
      FROM chats c
      JOIN community comm ON c.chat_id = comm.community_id
      JOIN chat_participants cp ON c.chat_id = cp.chat_id
      LEFT JOIN LATERAL (
        SELECT message, created_at
        FROM chat_messages
        WHERE chat_id = c.chat_id
        ORDER BY created_at DESC
        LIMIT 1
      ) cm ON true
      WHERE c.chat_type = 'community' AND cp.user_id = $1
      ORDER BY COALESCE(cm.created_at, c.created_at) DESC
    `,
      [userId],
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Error fetching community chats:", error);
    res.status(500).json({ message: "Error fetching community chats" });
  }
};

exports.joinCommunityChat = async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the user is already a member of the community
    const memberCheck = await pool.query(
      "SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
      [communityId, userId],
    );

    if (memberCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "You are already a member of this community chat" });
    }

    // Add user to the community chat
    await pool.query(
      "INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)",
      [communityId, userId],
    );

    res.status(201).json({ message: "Joined community chat successfully" });
  } catch (error) {
    logger.error("Error joining community chat:", error);
    res.status(500).json({ message: "Error joining community chat" });
  }
};

exports.leaveCommunityChat = async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      "DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2",
      [communityId, userId],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "You are not a member of this community chat" });
    }

    res.json({ message: "Left community chat successfully" });
  } catch (error) {
    logger.error("Error leaving community chat:", error);
    res.status(500).json({ message: "Error leaving community chat" });
  }
};

exports.pinMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user is an admin (for community chats) or a participant (for private chats)
    const userCheck = await pool.query(
      `
      SELECT c.chat_type, 
             CASE WHEN c.chat_type = 'community' THEN cm.role ELSE 'participant' END AS user_role
      FROM chats c
      LEFT JOIN community_memberships cm ON c.chat_id = cm.community_id AND cm.user_id = $1
      JOIN chat_participants cp ON c.chat_id = cp.chat_id AND cp.user_id = $1
      WHERE c.chat_id = $2
    `,
      [userId, chatId],
    );

    if (userCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this chat" });
    }

    const { chat_type, user_role } = userCheck.rows[0];

    if (chat_type === "community" && user_role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can pin messages in community chats" });
    }

    const result = await pool.query(
      "UPDATE chat_messages SET pinned = true WHERE message_id = $1 AND chat_id = $2 RETURNING *",
      [messageId, chatId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error pinning message:", error);
    res.status(500).json({ message: "Error pinning message" });
  }
};

exports.unpinMessage = async (req, res) => {
  const { chatId, messageId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user is an admin (for community chats) or a participant (for private chats)
    const userCheck = await pool.query(
      `
      SELECT c.chat_type, 
             CASE WHEN c.chat_type = 'community' THEN cm.role ELSE 'participant' END AS user_role
      FROM chats c
      LEFT JOIN community_memberships cm ON c.chat_id = cm.community_id AND cm.user_id = $1
      JOIN chat_participants cp ON c.chat_id = cp.chat_id AND cp.user_id = $1
      WHERE c.chat_id = $2
    `,
      [userId, chatId],
    );

    if (userCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You do not have access to this chat" });
    }

    const { chat_type, user_role } = userCheck.rows[0];

    if (chat_type === "community" && user_role !== "admin") {
      return res
        .status(403)
        .json({ message: "Only admins can unpin messages in community chats" });
    }

    const result = await pool.query(
      "UPDATE chat_messages SET pinned = false WHERE message_id = $1 AND chat_id = $2 RETURNING *",
      [messageId, chatId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Message not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error unpinning message:", error);
    res.status(500).json({ message: "Error unpinning message" });
  }
};

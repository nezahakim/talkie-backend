const { pool } = require("../config/database");
const { logger } = require("../utils/logger");

// exports.createCommunity = async (req, res) => {
//   const { name, description } = req.body;
//   const createdBy = req.user.userId;

//   try {
//     const result = await pool.query(
//       "INSERT INTO community (name, description, created_by) VALUES ($1, $2, $3) RETURNING *",
//       [name, description, createdBy],
//     );

//     const communityId = result.rows[0].community_id;

//     // Add the creator as a member with 'creator' role
//     await pool.query(
//       "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, $3)",
//       [communityId, createdBy, "creator"],
//     );

//     await pool.query(
//       `
//       WITH new_chat AS (
//         INSERT INTO chats (chat_type) VALUES ('community') RETURNING chat_id
//       )
//       INSERT INTO chat_participants (chat_id, user_id)
//       SELECT chat_id, unnest(ARRAY[$1, $2])
//       FROM new_chat
//       RETURNING chat_id
//     `,
//       [communityId, createdBy],
//     );

//     console.log("Community created successfully");
//     console.log(result.rows[0]);

//     res.status(201).json(result.rows[0]);
//   } catch (error) {
//     logger.error("Error creating community:", error);
//     res.status(500).json({ message: "Error creating community" });
//   }
// };

exports.createCommunity = async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.userId; // Assuming this is already a UUID

  try {
    const result = await pool.query(
      `INSERT INTO community (name, description, created_by) 
       VALUES ($1, $2, $3::uuid) 
       RETURNING *`,
      [name, description, userId],
    );

    const communityId = result.rows[0].community_id;

    //Add the creator as a member with 'creator' role
    await pool.query(
      "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, $3)",
      [communityId, userId, "creator"],
    );

    // After creating the community, create a corresponding chat
    await pool.query(
      `INSERT INTO chats (chat_id, chat_type) 
       VALUES ($1, 'community') 
       RETURNING *`,
      [result.rows[0].community_id],
    );

    // Add the creator as a participant in the chat
    await pool.query(
      `INSERT INTO chat_participants (chat_id, user_id) 
       VALUES ($1, $2::uuid)`,
      [result.rows[0].community_id, userId],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating community:", error);
    res
      .status(500)
      .json({ message: "Error creating community", error: error.message });
  }
};

exports.getCommunityDetails = async (req, res) => {
  const { communityId } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM community WHERE community_id = $1",
      [communityId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Community not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error fetching community details:", error);
    res.status(500).json({ message: "Error fetching community details" });
  }
};

exports.getAllComminties = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM community");

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No Community Founded" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error fetching communities details:", error);
    res.status(500).json({ message: "Error fetching community details" });
  }
};

exports.updateCommunity = async (req, res) => {
  const { communityId } = req.params;
  const { name, description } = req.body;
  const userId = req.user.userId;

  try {
    // Check if the user is an admin of the community
    const adminCheck = await pool.query(
      "SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND role = 'admin'",
      [communityId, userId],
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        message: "You don't have permission to update this community",
      });
    }

    const result = await pool.query(
      "UPDATE community SET name = $1, description = $2 WHERE community_id = $3 RETURNING *",
      [name, description, communityId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Community not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error updating community:", error);
    res.status(500).json({ message: "Error updating community" });
  }
};

exports.deleteCommunity = async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the user is an admin of the community
    const adminCheck = await pool.query(
      "SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND role = 'admin'",
      [communityId, userId],
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        message: "You don't have permission to delete this community",
      });
    }

    await pool.query("DELETE FROM community WHERE community_id = $1", [
      communityId,
    ]);

    res.json({ message: "Community deleted successfully" });
  } catch (error) {
    logger.error("Error deleting community:", error);
    res.status(500).json({ message: "Error deleting community" });
  }
};

exports.joinCommunity = async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if the user is already a member
    const memberCheck = await pool.query(
      "SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2",
      [communityId, userId],
    );

    if (memberCheck.rows.length > 0) {
      return res
        .status(400)
        .json({ message: "You are already a member of this community" });
    }

    await pool.query(
      "INSERT INTO community_memberships (community_id, user_id, role) VALUES ($1, $2, $3)",
      [communityId, userId, "member"],
    );

    await pool.query(
      `INSERT INTO chat_participants (chat_id, user_id) 
       VALUES ($1, $2::uuid)`,
      [communityId, userId],
    );

    res.status(201).json({ message: "Joined community successfully" });
  } catch (error) {
    logger.error("Error joining community:", error);
    res.status(500).json({ message: "Error joining community" });
  }
};

exports.leaveCommunity = async (req, res) => {
  const { communityId } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      "DELETE FROM community_memberships WHERE community_id = $1 AND user_id = $2",
      [communityId, userId],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "You are not a member of this community" });
    }

    await pool.query(
      `DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    res.json({ message: "Left community successfully" });
  } catch (error) {
    logger.error("Error leaving community:", error);
    res.status(500).json({ message: "Error leaving community" });
  }
};

exports.getCommunityMembers = async (req, res) => {
  const { communityId } = req.params;

  try {
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.profile_picture, cm.role, cm.joined_at
       FROM community_memberships cm
       JOIN users u ON cm.user_id = u.user_id
       WHERE cm.community_id = $1
       ORDER BY cm.joined_at ASC`,
      [communityId],
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Error fetching community members:", error);
    res.status(500).json({ message: "Error fetching community members" });
  }
};

exports.updateMemberRole = async (req, res) => {
  const { communityId, userId } = req.params;
  const { role } = req.body;
  const adminId = req.user.userId;

  try {
    // Check if the user making the request is an admin
    const adminCheck = await pool.query(
      "SELECT * FROM community_memberships WHERE community_id = $1 AND user_id = $2 AND role = 'admin'",
      [communityId, adminId],
    );

    if (adminCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ message: "You don't have permission to update member roles" });
    }

    const result = await pool.query(
      "UPDATE community_memberships SET role = $1 WHERE community_id = $2 AND user_id = $3 RETURNING *",
      [role, communityId, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Member not found in this community" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error("Error updating member role:", error);
    res.status(500).json({ message: "Error updating member role" });
  }
};

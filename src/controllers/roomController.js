const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

exports.createRoom = async (req, res) => {
  const { title, description, language, isPrivate, isTemporary, autoDelete } = req.body;
  const hostUserId = req.user.userId;

  try {
    const result = await pool.query(
      `INSERT INTO live_sessions 
       (host_user_id, session_title, description, language, is_private, is_temporary, auto_delete, started_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [hostUserId, title, description, language, isPrivate, isTemporary, autoDelete]
    );

    const room = result.rows[0];
    res.status(201).json(room);
  } catch (error) {
    logger.error('Error creating room:', error);
    res.status(500).json({ message: 'Error creating room' });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ls.*, u.username as host_username, COUNT(p.participant_id) as participant_count
      FROM live_sessions ls
      JOIN users u ON ls.host_user_id = u.user_id
      LEFT JOIN participants p ON ls.session_id = p.session_id
      WHERE ls.ended_at IS NULL
      GROUP BY ls.session_id, u.username
      ORDER BY ls.started_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Error fetching rooms' });
  }
};

exports.joinRoom = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  try {
    const roomResult = await pool.query('SELECT * FROM live_sessions WHERE session_id = $1', [sessionId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const participantResult = await pool.query(
      'INSERT INTO participants (session_id, user_id, joined_at, is_anonymous) VALUES ($1, $2, CURRENT_TIMESTAMP, false) RETURNING *',
      [sessionId, userId]
    );

    res.status(201).json(participantResult.rows[0]);
  } catch (error) {
    logger.error('Error joining room:', error);
    res.status(500).json({ message: 'Error joining room' });
  }
};

exports.leaveRoom = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      'UPDATE participants SET left_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL RETURNING *',
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Participant not found in the room' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error leaving room:', error);
    res.status(500).json({ message: 'Error leaving room' });
  }
};

exports.endRoom = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  try {
    const roomResult = await pool.query('SELECT * FROM live_sessions WHERE session_id = $1 AND host_user_id = $2', [sessionId, userId]);
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: 'Room not found or you are not the host' });
    }

    await pool.query('UPDATE live_sessions SET ended_at = CURRENT_TIMESTAMP WHERE session_id = $1', [sessionId]);
    await pool.query('UPDATE participants SET left_at = CURRENT_TIMESTAMP WHERE session_id = $1 AND left_at IS NULL', [sessionId]);

    res.json({ message: 'Room ended successfully' });
  } catch (error) {
    logger.error('Error ending room:', error);
    res.status(500).json({ message: 'Error ending room' });
  }
};

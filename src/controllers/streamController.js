const { pool } = require("../config/database");
const { logger } = require("../utils/logger");
const { processAudio } = require("../services/audioProcessing");

exports.startStreaming = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  try {
    const roomResult = await pool.query(
      "SELECT * FROM live_sessions WHERE session_id = $1",
      [sessionId],
    );
    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "Room not found" });
    }

    const speakerResult = await pool.query(
      "SELECT COUNT(*) as speaker_count FROM participants WHERE session_id = $1 AND is_speaker = true",
      [sessionId],
    );

    if (speakerResult.rows[0].speaker_count >= 20) {
      return res
        .status(400)
        .json({ message: "Maximum number of speakers reached" });
    }

    await pool.query(
      "UPDATE participants SET is_speaker = true WHERE session_id = $1 AND user_id = $2",
      [sessionId, userId],
    );

    res.json({ message: "Started streaming successfully" });
  } catch (error) {
    logger.error("Error starting stream:", error);
    res.status(500).json({ message: "Error starting stream" });
  }
};

exports.stopStreaming = async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  try {
    await pool.query(
      "UPDATE participants SET is_speaker = false WHERE session_id = $1 AND user_id = $2",
      [sessionId, userId],
    );

    res.json({ message: "Stopped streaming successfully" });
  } catch (error) {
    logger.error("Error stopping stream:", error);
    res.status(500).json({ message: "Error stopping stream" });
  }
};

exports.processAudioStream = async (req, res) => {
  const { audioData } = req.body;
  const userId = req.user.userId;

  try {
    const processedAudio = await processAudio(audioData);
    // Here you would typically send the processed audio to connected clients
    // This could be done through WebSockets or WebRTC
    res.json({ message: "Audio processed successfully" });
  } catch (error) {
    logger.error("Error processing audio stream:", error);
    res.status(500).json({ message: "Error processing audio stream" });
  }
};

exports.getActiveSpeakers = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const result = await pool.query(
      `
          SELECT u.user_id, u.username, u.profile_picture
          FROM participants p
          JOIN users u ON p.user_id = u.user_id
          WHERE p.session_id = $1 AND p.is_speaker = true
          ORDER BY p.joined_at ASC
        `,
      [sessionId],
    );

    res.json(result.rows);
  } catch (error) {
    logger.error("Error fetching active speakers:", error);
    res.status(500).json({ message: "Error fetching active speakers" });
  }
};

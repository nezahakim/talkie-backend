const express = require('express');
const { createRoom, getRooms, joinRoom, leaveRoom, endRoom } = require('../controllers/roomController');
const { startStreaming, stopStreaming, processAudioStream, getActiveSpeakers } = require('../controllers/streamController');
const auth = require('../middleware/auth');
const router = express.Router();

router.post('/', auth, createRoom);
router.get('/', getRooms);
router.post('/:sessionId/join', auth, joinRoom);
router.post('/:sessionId/leave', auth, leaveRoom);
router.post('/:sessionId/end', auth, endRoom);

router.post('/:sessionId/stream/start', auth, startStreaming);
router.post('/:sessionId/stream/stop', auth, stopStreaming);
router.post('/:sessionId/stream/process', auth, processAudioStream);
router.get('/:sessionId/speakers', auth, getActiveSpeakers);

module.exports = router;

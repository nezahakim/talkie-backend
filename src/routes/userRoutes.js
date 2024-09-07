const express = require('express');
const { getUserProfile, updateUserProfile, followUser, unfollowUser } = require('../controllers/userController');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/profile', auth, getUserProfile);
router.put('/profile', auth, updateUserProfile);
router.post('/follow/:userId', auth, followUser);
router.delete('/unfollow/:userId', auth, unfollowUser);

module.exports = router;

const express = require('express');
const { authController } = require('../controllers');
const { auth, authRateLimiter } = require('../middlewares');

const router = express.Router();

// Public routes
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);

// Protected routes
router.get('/users', auth, authController.getUsers);

module.exports = router;

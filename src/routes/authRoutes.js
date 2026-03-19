const express = require('express');
const { authController } = require('../controllers');

const { auth } = require('../middlewares');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/users', auth, authController.getUsers);

module.exports = router;

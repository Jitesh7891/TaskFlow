const express = require('express');
const { notificationController } = require('../controllers');
const { auth } = require('../middlewares');

const router = express.Router();

// All routes are protected
router.use(auth);

// GET /notifications
router.get('/', notificationController.getNotifications);

module.exports = router;

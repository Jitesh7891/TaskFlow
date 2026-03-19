const express = require('express');
const { taskController } = require('../controllers');
const { auth } = require('../middlewares');

const router = express.Router();

// All routes are protected
router.use(auth);

// POST /tasks
router.post('/', taskController.createTask);

// GET /tasks
router.get('/', taskController.getTasks);

// GET /tasks/:id
router.get('/:id', taskController.getTask);

// PATCH /tasks/:id
router.patch('/:id', taskController.updateTask);

// DELETE /tasks/:id
router.delete('/:id', taskController.deleteTask);

module.exports = router;

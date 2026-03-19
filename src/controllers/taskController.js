const { taskService } = require('../services');
const {
    createTaskSchema,
    updateTaskSchema,
    paginationSchema,
} = require('../utils/validators');

// Create task
const createTask = async (req, res, next) => {
    try {
        const validatedData = createTaskSchema.parse(req.body);
        const task = await taskService.createTask(validatedData, req.user);

        res.status(201).json({
            status: 'success',
            data: { task },
        });
    } catch (error) {
        next(error);
    }
};

// Get all tasks (paginated)
const getTasks = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await taskService.getTasks(req.user, page, limit);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// Get single task
const getTask = async (req, res, next) => {
    try {
        const task = await taskService.getTaskById(req.params.id, req.user);

        res.status(200).json({
            status: 'success',
            data: { task },
        });
    } catch (error) {
        next(error);
    }
};

// Update task
const updateTask = async (req, res, next) => {
    try {
        const validatedData = updateTaskSchema.parse(req.body);
        const task = await taskService.updateTask(req.params.id, validatedData, req.user);

        res.status(200).json({
            status: 'success',
            data: { task },
        });
    } catch (error) {
        next(error);
    }
};

// Delete task
const deleteTask = async (req, res, next) => {
    try {
        const result = await taskService.deleteTask(req.params.id, req.user);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTask,
    getTasks,
    getTask,
    updateTask,
    deleteTask,
};

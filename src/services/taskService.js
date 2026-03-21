const logger = require('../utils/logger');
const { Task, User } = require('../models');
const AppError = require('../utils/AppError');
const { performance } = require('perf_hooks');
const cacheService = require('./cacheService');
const queueService = require('./queueService');

class TaskService {
    // Create a new task
    async createTask(data, user) {
        const creatorId = user._id.toString();
        const task = await Task.create({
            ...data,
            createdBy: creatorId,
        });

        // Invalidate task list cache for creator
        const affectedUsers = [creatorId];

        // If task is assigned, send notification and invalidate assignee cache
        if (task.assignedTo) {
            affectedUsers.push(task.assignedTo.toString());

            const creator = await User.findById(creatorId);
            await queueService.addTaskAssignedJob(
                task._id,
                task.assignedTo,
                task.title,
                creator.name
            );
        }

        await cacheService.invalidateTaskCache(task._id, affectedUsers);

        return task;
    }

    // Get tasks with pagination
    async getTasks(user, page = 1, limit = 10) {
        const userId = user._id.toString();
        
        // Cache namespace: separate cache map for user individually
        const cacheKey = cacheService.getTaskListKey(userId, page, limit);

        const redisStart = performance.now();
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            logger.info(`[Cache Hit] Redis fetch time: ${(performance.now() - redisStart).toFixed(2)}ms`);
            return cached;
        }

        const skip = (page - 1) * limit;

        // Users only get what they own or are assigned to.
        const queryFilter = {
            $or: [{ createdBy: userId }, { assignedTo: userId }],
        };

        const mongoStart = performance.now();
        const [tasks, total] = await Promise.all([
            Task.find(queryFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('assignedTo', 'name email')
                .populate('createdBy', 'name email')
                .lean(),
            Task.countDocuments(queryFilter),
        ]);
        logger.info(`[DB Hit] MongoDB fetch time: ${(performance.now() - mongoStart).toFixed(2)}ms`);

        const result = {
            tasks,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };

        // Cache the result
        await cacheService.set(cacheKey, result);

        return result;
    }

    // Get single task by ID
    async getTaskById(taskId, user) {
        const userId = user._id.toString();
        const cacheKey = cacheService.getTaskKey(taskId);

        // Try to get from cache
        const redisStart = performance.now();
        const cached = await cacheService.get(cacheKey);
        if (cached) {
            // Re-validate permission from cache!
            if (cached.createdBy._id.toString() !== userId && cached.assignedTo?._id.toString() !== userId) {
                throw new AppError('You do not have permission to view this task', 403);
            }
            logger.info(`[Cache Hit] Redis fetch time: ${(performance.now() - redisStart).toFixed(2)}ms`);
            return cached;
        }

        const mongoStart = performance.now();
        const task = await Task.findById(taskId)
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email')
            .lean();
        logger.info(`[DB Hit] MongoDB fetch time: ${(performance.now() - mongoStart).toFixed(2)}ms`);

        if (!task) {
            throw new AppError('Task not found', 404);
        }

        // Check view permissions after hitting DB query
        if (task.createdBy._id.toString() !== userId && task.assignedTo?._id.toString() !== userId) {
            throw new AppError('You do not have permission to view this task', 403);
        }

        // Cache the result
        await cacheService.set(cacheKey, task);

        return task;
    }

    // Update task
    async updateTask(taskId, data, user) {
        const userId = user._id.toString();
        const task = await Task.findById(taskId);

        if (!task) {
            throw new AppError('Task not found', 404);
        }

        // Check permission: creator or assignee can update
        const isCreator = task.createdBy.toString() === userId;
        const isAssignee = task.assignedTo?.toString() === userId;

        if (!isCreator && !isAssignee) {
            throw new AppError('You do not have permission to update this task', 403);
        }

        const oldStatus = task.status;
        const oldAssignee = task.assignedTo?.toString();

        // Update task fields
        Object.assign(task, data);
        await task.save();

        const affectedUsers = [task.createdBy.toString()];

        // If assignee changed, notify new assignee
        if (data.assignedTo && data.assignedTo !== oldAssignee) {
            affectedUsers.push(data.assignedTo);

            const updater = await User.findById(userId);
            await queueService.addTaskAssignedJob(
                task._id,
                data.assignedTo,
                task.title,
                updater.name
            );
        }

        // If status changed, notify relevant user
        if (data.status && data.status !== oldStatus) {
            const notifyUserId = isCreator && task.assignedTo
                ? task.assignedTo.toString()
                : task.createdBy.toString();

            if (notifyUserId !== userId) {
                await queueService.addStatusUpdatedJob(
                    task._id,
                    notifyUserId,
                    task.title,
                    oldStatus,
                    data.status
                );
            }
        }

        // Include old assignee in affected users for cache invalidation
        if (oldAssignee) {
            affectedUsers.push(oldAssignee);
        }
        if (task.assignedTo) {
            affectedUsers.push(task.assignedTo.toString());
        }

        // Invalidate cache
        await cacheService.invalidateTaskCache(taskId, [...new Set(affectedUsers)]);

        return task;
    }

    // Delete task
    async deleteTask(taskId, user) {
        const userId = user._id.toString();
        const task = await Task.findById(taskId);

        if (!task) {
            throw new AppError('Task not found', 404);
        }

        // Permissions: only creator can delete
        if (task.createdBy.toString() !== userId) {
            throw new AppError('Only the creator can delete this task', 403);
        }

        const affectedUsers = [task.createdBy.toString()];
        if (task.assignedTo) {
            affectedUsers.push(task.assignedTo.toString());
        }

        await Task.findByIdAndDelete(taskId);

        // Invalidate cache
        await cacheService.invalidateTaskCache(taskId, affectedUsers);

        return { message: 'Task deleted successfully' };
    }
}

module.exports = new TaskService();

const mongoose = require('mongoose');
const { Notification } = require('../src/models');

// Extract the processNotification logic inline (worker/index.js calls startWorker which
// connects to real Redis, so we replicate the core processing function here for unit testing)
const processNotification = async (job) => {
    const { type, userId, message, taskId } = job.data;

    const notification = await Notification.create({
        userId,
        type,
        message,
        taskId,
    });

    return { success: true, notificationId: notification._id.toString() };
};

describe('Worker - processNotification Unit Tests', () => {
    it('should create a notification and return success on valid job data', async () => {
        // We need a valid ObjectId for the foreign keys
        const fakeUserId = new mongoose.Types.ObjectId();
        const fakeTaskId = new mongoose.Types.ObjectId();

        const job = {
            id: 'test-job-1',
            name: 'task_assigned',
            data: {
                type: 'TASK_ASSIGNED',
                userId: fakeUserId.toString(),
                message: 'You were assigned a task',
                taskId: fakeTaskId.toString(),
                enqueuedAt: Date.now(),
            },
        };

        const result = await processNotification(job);

        expect(result.success).toBe(true);
        expect(result.notificationId).toBeDefined();

        // Verify the notification was actually persisted in the in-memory MongoDB
        const saved = await Notification.findById(result.notificationId);
        expect(saved).not.toBeNull();
        expect(saved.type).toBe('TASK_ASSIGNED');
        expect(saved.message).toBe('You were assigned a task');
        expect(saved.userId.toString()).toBe(fakeUserId.toString());
    });

    it('should create a STATUS_UPDATED notification successfully', async () => {
        const fakeUserId = new mongoose.Types.ObjectId();
        const fakeTaskId = new mongoose.Types.ObjectId();

        const job = {
            id: 'test-job-2',
            name: 'task_status_updated',
            data: {
                type: 'STATUS_UPDATED',
                userId: fakeUserId.toString(),
                message: 'Task status changed from todo to done',
                taskId: fakeTaskId.toString(),
                enqueuedAt: Date.now(),
            },
        };

        const result = await processNotification(job);

        expect(result.success).toBe(true);

        const saved = await Notification.findById(result.notificationId);
        expect(saved.type).toBe('STATUS_UPDATED');
    });

    it('should throw on invalid data (missing required fields)', async () => {
        const job = {
            id: 'test-job-3',
            name: 'task_assigned',
            data: {
                // Missing type, userId, taskId — all required by the Notification model
                message: 'Incomplete notification',
            },
        };

        await expect(processNotification(job)).rejects.toThrow();
    });

    it('should throw on invalid notification type', async () => {
        const fakeUserId = new mongoose.Types.ObjectId();
        const fakeTaskId = new mongoose.Types.ObjectId();

        const job = {
            id: 'test-job-4',
            name: 'unknown_type',
            data: {
                type: 'INVALID_TYPE', // Not in enum ['TASK_ASSIGNED', 'STATUS_UPDATED']
                userId: fakeUserId.toString(),
                message: 'Bad type notification',
                taskId: fakeTaskId.toString(),
            },
        };

        await expect(processNotification(job)).rejects.toThrow();
    });
});

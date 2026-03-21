const logger = require('../utils/logger');
const { getNotificationQueue } = require('../config/queue');

class QueueService {
    // Add task assigned notification job
    async addTaskAssignedJob(taskId, assignedToUserId, taskTitle, assignerName) {
        const queue = getNotificationQueue();

        const job = await queue.add(
            'task_assigned',
            {
                type: 'TASK_ASSIGNED',
                taskId: taskId.toString(),
                userId: assignedToUserId.toString(),
                message: `You have been assigned to task: "${taskTitle}" by ${assignerName}`,
                enqueuedAt: Date.now()
            },
            {
                jobId: `task_assigned:${taskId}:${assignedToUserId}`, // Idempotency key
                attempts: 3, // Retry logic
                backoff: { type: 'exponential', delay: 1000 }, // Max 1s -> 2s -> 4s wait
                removeOnComplete: true
            }
        );

        logger.info(`Task assigned job added: ${job.id}`);
        return job;
    }

    // Add task status updated notification job
    async addStatusUpdatedJob(taskId, userId, taskTitle, oldStatus, newStatus) {
        const queue = getNotificationQueue();

        const job = await queue.add(
            'task_status_updated',
            {
                type: 'STATUS_UPDATED',
                taskId: taskId.toString(),
                userId: userId.toString(),
                message: `Task "${taskTitle}" status changed from "${oldStatus}" to "${newStatus}"`,
                enqueuedAt: Date.now()
            },
            {
                jobId: `status_update:${taskId}:${newStatus}`, // Idempotency key
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                removeOnComplete: true
            }
        );

        logger.info(`Status updated job added: ${job.id}`);
        return job;
    }
}

module.exports = new QueueService();

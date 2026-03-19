const { getNotificationQueue } = require('../config/queue');

class QueueService {
    // Add task assigned notification job
    async addTaskAssignedJob(taskId, assignedToUserId, taskTitle, assignerName) {
        const queue = getNotificationQueue();

        const job = await queue.add('task_assigned', {
            type: 'TASK_ASSIGNED',
            taskId: taskId.toString(),
            userId: assignedToUserId.toString(),
            message: `You have been assigned to task: "${taskTitle}" by ${assignerName}`,
            enqueuedAt: Date.now()
        });

        console.log(`Task assigned job added: ${job.id}`);
        return job;
    }

    // Add task status updated notification job
    async addStatusUpdatedJob(taskId, userId, taskTitle, oldStatus, newStatus) {
        const queue = getNotificationQueue();

        const job = await queue.add('task_status_updated', {
            type: 'STATUS_UPDATED',
            taskId: taskId.toString(),
            userId: userId.toString(),
            message: `Task "${taskTitle}" status changed from "${oldStatus}" to "${newStatus}"`,
            enqueuedAt: Date.now()
        });

        console.log(`Status updated job added: ${job.id}`);
        return job;
    }
}

module.exports = new QueueService();

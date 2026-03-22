const { Queue } = require('bullmq');
const { getRedisClient } = require('./redis');

let notificationQueue = null;
let dlqQueue = null;

const getNotificationQueue = () => {
    if (!notificationQueue) {
        notificationQueue = new Queue('notifications', {
            connection: getRedisClient(),
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        });
    }
    return notificationQueue;
};

const getDlqQueue = () => {
    if (!dlqQueue) {
        dlqQueue = new Queue('dlq', {
            connection: getRedisClient(),
            defaultJobOptions: {
                attempts: 1, // Only 1 attempt for dead letter queue
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        });
    }
    return dlqQueue;
};

const closeQueue = async () => {
    if (notificationQueue) {
        await notificationQueue.close();
        notificationQueue = null;
    }
    if (dlqQueue) {
        await dlqQueue.close();
        dlqQueue = null;
    }
};

module.exports = { getNotificationQueue, getDlqQueue, closeQueue };

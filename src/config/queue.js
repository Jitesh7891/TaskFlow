const { Queue } = require('bullmq');
const { getRedisClient } = require('./redis');

let notificationQueue = null;

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

const closeQueue = async () => {
    if (notificationQueue) {
        await notificationQueue.close();
        notificationQueue = null;
    }
};

module.exports = { getNotificationQueue, closeQueue };

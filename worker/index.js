const logger = require('../src/utils/logger');
require('dotenv').config();
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { getRedisClient, closeRedis } = require('../src/config/redis');
const { Notification } = require('../src/models');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Worker: MongoDB connected');
    } catch (error) {
        logger.error('Worker: MongoDB connection error:', error.message);
        process.exit(1);
    }
};

// Process notification job
const processNotification = async (job) => {
    logger.info(`Processing job ${job.id}: ${job.name}`);

    const { type, userId, message, taskId, enqueuedAt } = job.data;

    // Create notification in database
    const notification = await Notification.create({
        userId,
        type,
        message,
        taskId,
    });

    logger.info(`[Database] Notification created: ${notification._id}`);

    const queueTotalTime = enqueuedAt ? Date.now() - enqueuedAt : 'N/A';

    // DEMO LOGGING
    logger.info('----------------------------------------');
    logger.info(`✅ [Worker] Job ${job.id} COMPLETED`);
    logger.info(`   Type: ${type}`);
    logger.info(`   Message: "${message}"`);
    logger.info('   Action: Saved to MongoDB');
    logger.info(`   Queue Wait + Exec Time: ${queueTotalTime}ms`);
    logger.info('----------------------------------------');

    return { success: true, notificationId: notification._id.toString() };
};

// Start worker
const startWorker = async () => {
    await connectDB();

    const worker = new Worker(
        'notifications',
        processNotification,
        {
            connection: getRedisClient(),
            concurrency: 5,
        }
    );

    worker.on('completed', (job, result) => {
        logger.info(`Job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        const attemptsMade = job?.attemptsMade || 1;
        const maxAttempts = job?.opts?.attempts || 1;
        
        logger.error(`[Worker] Job ${job?.id} failed: ${error.message}`);
        
        if (attemptsMade >= maxAttempts) {
            logger.error(`[DEAD LETTER] Job ${job?.id} permanently failed after ${attemptsMade} attempts! Triggering alert.`);
        } else {
            logger.warn(`[Worker] Job ${job?.id} will be retried. Attempt ${attemptsMade} of ${maxAttempts} failed.`);
        }
    });

    worker.on('error', (error) => {
        logger.error('Worker error:', error);
    });

    logger.info('Worker started and listening for jobs...');

    // Graceful shutdown
    const shutdown = async (signal) => {
        logger.info(`\n${signal} received. Shutting down worker...`);
        await worker.close();
        await closeRedis();
        await mongoose.connection.close();
        logger.info('Worker shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

startWorker();

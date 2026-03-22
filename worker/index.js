const logger = require('../src/utils/logger');
require('dotenv').config();
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { getRedisClient, closeRedis } = require('../src/config/redis');
const { getDlqQueue } = require('../src/config/queue');
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

// Process DLQ job
const processDlq = async (job) => {
    logger.info(`[DLQ Worker] Processing dead letter job ${job.id}: ${job.name}`);
    
    // We try processing the notification one last time
    try {
        await processNotification(job);
        return { success: true, recovered: true };
    } catch (error) {
        // If it throws, BullMQ catches it and marks it failed (permanent failure)
        throw error;
    }
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

    const dlqWorker = new Worker(
        'dlq',
        processDlq,
        {
            connection: getRedisClient(),
            concurrency: 2,
        }
    );

    // Main Worker Events
    worker.on('completed', (job, result) => {
        logger.info(`Job ${job.id} completed:`, result);
    });

    worker.on('failed', async (job, error) => {
        const attemptsMade = job?.attemptsMade || 1;
        const maxAttempts = job?.opts?.attempts || 1;
        
        logger.error(`[Worker] Job ${job?.id} failed: ${error.message}`);
        
        if (attemptsMade >= maxAttempts) {
            logger.error(`[DEAD LETTER] Job ${job?.id} permanently failed after ${attemptsMade} attempts! Moving to DLQ.`);
            try {
                const dlq = getDlqQueue();
                await dlq.add(job.name, job.data, {
                    jobId: `dlq:${job.id}`,
                });
                logger.info(`[DEAD LETTER] Job ${job?.id} successfully moved to DLQ.`);
            } catch (dlqError) {
                logger.error(`[DEAD LETTER] Failed to move Job ${job?.id} to DLQ: ${dlqError.message}`);
            }
        } else {
            logger.warn(`[Worker] Job ${job?.id} will be retried. Attempt ${attemptsMade} of ${maxAttempts} failed.`);
        }
    });

    worker.on('error', (error) => {
        logger.error('Worker error:', error);
    });

    // DLQ Worker Events
    dlqWorker.on('completed', (job) => {
        logger.info(`[DLQ Worker] EVENTUAL SUCCESS: Job ${job.id} was successfully recovered in DLQ!`);
    });

    dlqWorker.on('failed', (job, error) => {
        logger.error(`[DLQ Worker] PERMANENT FAILURE: Job ${job.id} failed in DLQ. Reason: ${error.message}. This job is now truly dead.`);
    });
    
    dlqWorker.on('error', (error) => {
        logger.error('DLQ Worker error:', error);
    });

    logger.info('Workers started and listening for jobs...');

    // Graceful shutdown
    const shutdown = async (signal) => {
        logger.info(`\n${signal} received. Shutting down worker...`);
        await worker.close();
        await dlqWorker.close();
        await closeRedis();
        await mongoose.connection.close();
        logger.info('Worker shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

startWorker();

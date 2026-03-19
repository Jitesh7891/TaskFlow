require('dotenv').config();
const { Worker } = require('bullmq');
const mongoose = require('mongoose');
const { getRedisClient, closeRedis } = require('../src/config/redis');
const { Notification } = require('../src/models');

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Worker: MongoDB connected');
    } catch (error) {
        console.error('Worker: MongoDB connection error:', error.message);
        process.exit(1);
    }
};

// Process notification job
const processNotification = async (job) => {
    console.log(`Processing job ${job.id}: ${job.name}`);

    const { type, userId, message, taskId, enqueuedAt } = job.data;

    // Create notification in database
    const notification = await Notification.create({
        userId,
        type,
        message,
        taskId,
    });

    console.log(`[Database] Notification created: ${notification._id}`);

    const queueTotalTime = enqueuedAt ? Date.now() - enqueuedAt : 'N/A';

    // DEMO LOGGING
    console.log('----------------------------------------');
    console.log(`✅ [Worker] Job ${job.id} COMPLETED`);
    console.log(`   Type: ${type}`);
    console.log(`   Message: "${message}"`);
    console.log('   Action: Saved to MongoDB');
    console.log(`   Queue Wait + Exec Time: ${queueTotalTime}ms`);
    console.log('----------------------------------------');

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
        console.log(`Job ${job.id} completed:`, result);
    });

    worker.on('failed', (job, error) => {
        console.error(`Job ${job?.id} failed:`, error.message);
    });

    worker.on('error', (error) => {
        console.error('Worker error:', error);
    });

    console.log('Worker started and listening for jobs...');

    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\n${signal} received. Shutting down worker...`);
        await worker.close();
        await closeRedis();
        await mongoose.connection.close();
        console.log('Worker shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

startWorker();

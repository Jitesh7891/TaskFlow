const logger = require('./src/utils/logger');
require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { getRedisClient, closeRedis } = require('./src/config/redis');
const { closeQueue } = require('./src/config/queue');

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    logger.info(`\n${signal} received. Shutting down gracefully...`);

    try {
        await closeQueue();
        await closeRedis();
        logger.info('Connections closed. Exiting...');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
};

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Initialize Redis connection
        getRedisClient();

        // Start Express server
        const server = app.listen(PORT, () => {
            logger.info(`API Server running on port ${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return server;
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

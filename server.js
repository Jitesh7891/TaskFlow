require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/database');
const { getRedisClient, closeRedis } = require('./src/config/redis');
const { closeQueue } = require('./src/config/queue');

const PORT = process.env.PORT || 3000;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
        await closeQueue();
        await closeRedis();
        console.log('Connections closed. Exiting...');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
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
            console.log(`API Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Handle graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        return server;
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

const logger = require('../utils/logger');
const Redis = require('ioredis');

let redis = null;

const getRedisClient = () => {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error('REDIS_URL environment variable is required');
        }

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });

        redis.on('connect', () => {
            logger.info('Redis connected');
        });

        redis.on('error', (err) => {
            logger.error('Redis error:', err.message);
        });
    }
    return redis;
};

const closeRedis = async () => {
    if (redis) {
        await redis.quit();
        redis = null;
    }
};

module.exports = { getRedisClient, closeRedis };

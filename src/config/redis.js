const logger = require('../utils/logger');
const Redis = require('ioredis');

let redis = null;

const getRedisClient = () => {
    if (!redis) {
        const redisUrl = process.env.REDIS_URL;
        const options = {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        if (redisUrl) {
            redis = new Redis(redisUrl, options);
        } else {
            redis = new Redis({
                ...options,
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
            });
        }

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

const Redis = require('ioredis');

let redis = null;

const getRedisClient = () => {
    if (!redis) {
        redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        });

        redis.on('connect', () => {
            console.log('Redis connected');
        });

        redis.on('error', (err) => {
            console.error('Redis error:', err.message);
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

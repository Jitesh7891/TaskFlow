const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

const CACHE_TTL = 60; // 60 seconds

class CacheService {
    constructor() {
        this.redis = getRedisClient();
    }

    // Generate cache key for task list
    getTaskListKey(userId, page, limit) {
        return `tasks:user:${userId}:page:${page}:limit:${limit}`;
    }

    // Generate cache key for single task
    getTaskKey(taskId) {
        return `task:${taskId}`;
    }

    // Get cached data
    async get(key) {
        try {
            const data = await this.redis.get(key);
            if (data) {
                logger.info(`[Cache] HIT: ${key}`);
                return JSON.parse(data);
            }
            logger.info(`[Cache] MISS: ${key}`);
            return null;
        } catch (error) {
            logger.error('Cache get error:', error.message);
            return null;
        }
    }

    // Set cached data
    async set(key, data, ttl = CACHE_TTL) {
        try {
            await this.redis.setex(key, ttl, JSON.stringify(data));
        } catch (error) {
            logger.error('Cache set error:', error.message);
        }
    }

    // Delete cached data
    async delete(key) {
        try {
            await this.redis.del(key);
        } catch (error) {
            logger.error('Cache delete error:', error.message);
        }
    }

    // Invalidate all task caches for a user
    async invalidateUserTaskCache(userId) {
        try {
            const pattern = `tasks:user:${userId}:*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            logger.error('Cache invalidation error:', error.message);
        }
    }

    // Invalidate task cache on mutation
    async invalidateTaskCache(taskId, affectedUserIds = []) {
        try {
            // Delete single task cache
            await this.delete(this.getTaskKey(taskId));

            // Delete all task lists for affected users
            for (const userId of affectedUserIds) {
                await this.invalidateUserTaskCache(userId);
            }
        } catch (error) {
            logger.error('Task cache invalidation error:', error.message);
        }
    }
}

module.exports = new CacheService();

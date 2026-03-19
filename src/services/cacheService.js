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
                console.log(`[Cache] HIT: ${key}`);
                return JSON.parse(data);
            }
            console.log(`[Cache] MISS: ${key}`);
            return null;
        } catch (error) {
            console.error('Cache get error:', error.message);
            return null;
        }
    }

    // Set cached data
    async set(key, data, ttl = CACHE_TTL) {
        try {
            await this.redis.setex(key, ttl, JSON.stringify(data));
        } catch (error) {
            console.error('Cache set error:', error.message);
        }
    }

    // Delete cached data
    async delete(key) {
        try {
            await this.redis.del(key);
        } catch (error) {
            console.error('Cache delete error:', error.message);
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
            console.error('Cache invalidation error:', error.message);
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
            console.error('Task cache invalidation error:', error.message);
        }
    }
}

module.exports = new CacheService();

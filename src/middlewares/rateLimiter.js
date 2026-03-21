const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');
const AppError = require('../utils/AppError');

const rateLimiter = async (req, res, next) => {
    // Skip rate limiting for CORS preflight requests
    if (req.method === 'OPTIONS') return next();

    try {
        const redis = getRedisClient();

        // Use userId if authenticated, otherwise fall back to IP
        const identifier = req.userId || req.ip || 'anonymous';
        const key = `ratelimit:${identifier}`;

        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
        const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 60;

        // Get current count
        const current = await redis.get(key);

        if (current && parseInt(current) >= maxRequests) {
            throw new AppError('Too many requests. Please try again later.', 429);
        }

        // Increment counter
        const multi = redis.multi();
        multi.incr(key);
        multi.pexpire(key, windowMs);
        await multi.exec();

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': maxRequests,
            'X-RateLimit-Remaining': Math.max(0, maxRequests - (parseInt(current) || 0) - 1),
        });

        next();
    } catch (error) {
        if (error.statusCode === 429) {
            return next(error);
        }
        // If Redis fails, allow the request (fail-open)
        logger.error('Rate limiter error:', error.message);
        next();
    }
};

module.exports = rateLimiter;

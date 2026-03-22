const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');
const AppError = require('../utils/AppError');

const createRateLimiter = ({ 
    windowMs = 60000, 
    maxRequests = 100, 
    keyPrefix = 'ratelimit', 
    useUserId = true 
}) => {
    return async (req, res, next) => {
        if (req.method === 'OPTIONS') return next();

        try {
            const redis = getRedisClient();

            // Use userId if authenticated, otherwise fall back to IP. For auth routes, useUserId is false (only IP).
            const identifier = (useUserId && req.userId) ? req.userId : (req.ip || 'anonymous');
            const key = `${keyPrefix}:${identifier}`;

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
            logger.error('Rate limiter error:', error.message);
            next();
        }
    };
};

const globalRateLimiter = createRateLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    keyPrefix: 'ratelimit',
    useUserId: true
});

const authRateLimiter = createRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 10,  // 10 requests per minute
    keyPrefix: 'ratelimit:auth',
    useUserId: false // Strictly IP based
});

module.exports = { globalRateLimiter, authRateLimiter };

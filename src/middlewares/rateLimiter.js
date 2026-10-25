const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');
const AppError = require('../utils/AppError');

// Redis executes a Lua script atomically. This keeps the limit check, increment,
// and first-window expiry together even when many requests arrive at once.
const fixedWindowRateLimitScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local maxRequests = tonumber(ARGV[2])

if current >= maxRequests then
    return {0, current, redis.call('PTTL', KEYS[1])}
end

local newCount = redis.call('INCR', KEYS[1])

-- Start the fixed window only once. Do not reset it on later requests.
if newCount == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

return {1, newCount, redis.call('PTTL', KEYS[1])}
`;

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

            const [allowed, count, ttl] = await redis.eval(
                fixedWindowRateLimitScript,
                1,
                key,
                windowMs,
                maxRequests
            );
            const remaining = Math.max(0, maxRequests - Number(count));

            // Set rate limit headers for both allowed and blocked requests.
            res.set({
                'X-RateLimit-Limit': maxRequests,
                'X-RateLimit-Remaining': remaining,
            });

            if (Number(allowed) !== 1) {
                const retryAfter = Math.max(1, Math.ceil(Math.max(0, Number(ttl)) / 1000));
                res.set('Retry-After', retryAfter.toString());
                throw new AppError('Too many requests. Please try again later.', 429);
            }

            next();
        } catch (error) {
            if (error.statusCode === 429) {
                return next(error);
            }
            // Keep the API available if Redis is temporarily unavailable.
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

module.exports = { globalRateLimiter, authRateLimiter, fixedWindowRateLimitScript };

const auth = require('./auth');
const extractUserId = require('./extractUserId');
const { globalRateLimiter, authRateLimiter } = require('./rateLimiter');
const errorHandler = require('./errorHandler');
const requireRole = require('./requireRole');

module.exports = {
    auth,
    extractUserId,
    globalRateLimiter,
    authRateLimiter,
    errorHandler,
    requireRole,
};

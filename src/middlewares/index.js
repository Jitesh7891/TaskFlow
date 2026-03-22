const auth = require('./auth');
const { globalRateLimiter, authRateLimiter } = require('./rateLimiter');
const errorHandler = require('./errorHandler');
const requireRole = require('./requireRole');

module.exports = {
    auth,
    globalRateLimiter,
    authRateLimiter,
    errorHandler,
    requireRole,
};

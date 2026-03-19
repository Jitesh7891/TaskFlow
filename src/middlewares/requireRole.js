const AppError = require('../utils/AppError');

/**
 * Middleware strictly gating routes based on user roles
 * @param  {...string} roles - array of allowed roles
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return next(new AppError('Unauthorized: Role information missing', 401));
        }

        if (!roles.includes(req.user.role)) {
            return next(new AppError(`Forbidden: Requires one of these roles: ${roles.join(', ')}`, 403));
        }

        next();
    };
};

module.exports = requireRole;

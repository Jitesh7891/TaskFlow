const jwt = require('jsonwebtoken');

const extractUserId = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            if (decoded && decoded.userId) {
                req.userId = decoded.userId;
            }
        }
    } catch (err) {
        // Ignore token errors, let actual auth middleware handle invalid tokens
    }
    next();
};

module.exports = extractUserId;

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { User } = require('../models');

const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Authentication required. Please log in.', 401);
        }

        const token = authHeader.split(' ')[1];
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        
        const user = await User.findById(decoded.userId);
        if (!user) {
            throw new AppError('The user belonging to this token no longer exists.', 401);
        }

        req.user = user;
        req.userId = user._id.toString();
        
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = auth;

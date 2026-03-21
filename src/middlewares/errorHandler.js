const logger = require('../utils/logger');
const { z } = require('zod');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
        logger.error('Error:', err);
    }

    // Handle Zod validation errors (Zod v4 uses 'issues')
    if (err instanceof z.ZodError || err.name === 'ZodError') {
        const issues = err.issues || err.errors || [];
        const errors = issues.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        return res.status(400).json({
            status: 'fail',
            message: 'Validation error',
            errors,
        });
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        return res.status(400).json({
            status: 'fail',
            message: 'Validation error',
            errors,
        });
    }

    // Handle Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            status: 'fail',
            message: `${field} already exists`,
        });
    }

    // Handle Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            status: 'fail',
            message: `Invalid ${err.path}: ${err.value}`,
        });
    }

    // Handle operational errors
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }

    // Handle unexpected errors
    logger.error('Unexpected error:', err);
    return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
    });
};

module.exports = errorHandler;

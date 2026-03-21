const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const logger = require('./utils/logger');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger.json');
const { rateLimiter, errorHandler } = require('./middlewares');
const { authRoutes, taskRoutes, notificationRoutes } = require('./routes');

const app = express();

// Global request interceptor for logging
if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
}

// CORS for frontend
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
}));

// Body parser
app.use(express.json());

// Track API response time
const responseTime = require('./middlewares/responseTime');
app.use(responseTime);

// Rate limiter (applies to all routes)
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auto-compiled API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ status: 'fail', message: 'Route not found' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;

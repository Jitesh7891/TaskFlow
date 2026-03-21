const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';

// Create a centralized structured JSON logger
const logger = pino({
    level: isTest ? 'silent' : process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }) // Maps integer level to human-readable string level in JSON output
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;

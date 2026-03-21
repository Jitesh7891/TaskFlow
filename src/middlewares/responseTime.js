const logger = require('../utils/logger');

const responseTime = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const duration = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
        
        logger.info({ 
            msg: `[API Time] ${req.method} ${req.originalUrl}`,
            durationMs: Number(duration),
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode
        });
    });

    next();
};

module.exports = responseTime;

const { performance } = require('perf_hooks');

module.exports = (req, res, next) => {
    const start = performance.now();
    
    res.on('finish', () => {
        const duration = (performance.now() - start).toFixed(2);
        console.log(`[API Time] ${req.method} ${req.originalUrl} - ${duration}ms`);
    });
    
    next();
};

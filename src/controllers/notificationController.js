const { notificationService } = require('../services');
const { paginationSchema } = require('../utils/validators');

// Get notifications (paginated, newest first)
const getNotifications = async (req, res, next) => {
    try {
        const { page, limit } = paginationSchema.parse(req.query);
        const result = await notificationService.getNotifications(req.userId, page, limit);

        res.status(200).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotifications,
};

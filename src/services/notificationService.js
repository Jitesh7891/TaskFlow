const { Notification } = require('../models');

class NotificationService {
    // Get notifications for user with pagination
    async getNotifications(userId, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            Notification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('taskId', 'title status')
                .lean(),
            Notification.countDocuments({ userId }),
        ]);

        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    // Create notification (used by worker)
    async createNotification(data) {
        const notification = await Notification.create(data);
        return notification;
    }
}

module.exports = new NotificationService();

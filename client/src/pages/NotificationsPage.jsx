import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function NotificationsPage({ onToast }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pages: 1 });

    const fetchNotifications = async (page = 1) => {
        try {
            // Only set loading on initial fetch
            if (notifications.length === 0) setLoading(true);
            const data = await api.getNotifications(page, 20);
            setNotifications(data.data.notifications);
            setPagination(data.data.pagination);
        } catch (err) {
            onToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchNotifications(); }, []);

    const formatTime = (date) => {
        const d = new Date(date);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);

        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Notifications</h1>
                <button className="btn btn-secondary" onClick={() => fetchNotifications(1)}>
                    ↻ Refresh
                </button>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : notifications.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔔</div>
                    <h3 className="empty-state-title">No notifications</h3>
                    <p>You're all caught up!</p>
                </div>
            ) : (
                <>
                    <div className="notifications-list">
                        {notifications.map((notif) => (
                            <div key={notif._id} className={`notification-item ${!notif.isRead ? 'unread' : ''}`}>
                                <div className={`notification-icon ${notif.type === 'TASK_ASSIGNED' ? 'assigned' : 'updated'}`}>
                                    {notif.type === 'TASK_ASSIGNED' ? '👤' : '✓'}
                                </div>
                                <div className="notification-content">
                                    <p className="notification-message">{notif.message}</p>
                                    <span className="notification-time">{formatTime(notif.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pagination.pages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page === 1}
                                onClick={() => fetchNotifications(pagination.page - 1)}
                            >← Prev</button>
                            <span style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => fetchNotifications(pagination.page + 1)}
                            >Next →</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

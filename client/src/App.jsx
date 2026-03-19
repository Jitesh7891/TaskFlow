import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { TasksPage } from './pages/TasksPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { api } from './services/api';
import './index.css';

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('tasks');
  const [toasts, setToasts] = useState([]);
  const [rateLimit, setRateLimit] = useState({ remaining: 60, max: 60 });

  // Update rate limit display periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimit(api.getRateLimit());
    }, 1000);
    return () => clearInterval(interval);
  }, []);



  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  if (loading) {
    return <div className="loading" style={{ minHeight: '100vh' }}><div className="spinner"></div></div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  const rateLimitPercent = (rateLimit.remaining / rateLimit.max) * 100;
  const isLow = rateLimitPercent < 30;

  return (
    <div className="app">
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && '✓ '}
            {toast.type === 'error' && '✕ '}
            {toast.type === 'info' && 'ℹ '}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <span>TaskFlow</span>
          </div>

          <nav className="nav-menu">
            <li className="nav-item">
              <button
                className={`nav-link ${currentPage === 'tasks' ? 'active' : ''}`}
                onClick={() => setCurrentPage('tasks')}
              >
                📋 Tasks
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${currentPage === 'notifications' ? 'active' : ''}`}
                onClick={() => setCurrentPage('notifications')}
              >
                🔔 Notifications
              </button>
            </li>
          </nav>

          <div className="user-info">
            <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout">⏻</button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Rate Limit Indicator */}
          <div className="rate-limit-bar">
            <span className="rate-limit-text">
              API: {rateLimit.remaining}/{rateLimit.max} requests
            </span>
            <div className="rate-limit-progress">
              <div
                className={`rate-limit-fill ${isLow ? 'warning' : ''}`}
                style={{ width: `${rateLimitPercent}%` }}
              ></div>
            </div>
          </div>

          {currentPage === 'tasks' && <TasksPage onToast={addToast} />}
          {currentPage === 'notifications' && <NotificationsPage onToast={addToast} />}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

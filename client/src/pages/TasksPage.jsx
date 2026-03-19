import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function TasksPage({ onToast }) {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pages: 1 });

    const fetchTasks = async (page = 1) => {
        try {
            setLoading(true);
            const data = await api.getTasks(page, 10);
            setTasks(data.data.tasks);
            setPagination(data.data.pagination);
        } catch (err) {
            onToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTasks(); }, []);

    const handleCreate = () => {
        setEditingTask(null);
        setShowModal(true);
    };

    const handleEdit = (task) => {
        setEditingTask(task);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this task?')) return;
        try {
            await api.deleteTask(id);
            onToast('Task deleted', 'success');
            fetchTasks(pagination.page);
        } catch (err) {
            onToast(err.message, 'error');
        }
    };

    const handleStatusChange = async (task, newStatus) => {
        try {
            await api.updateTask(task._id, { status: newStatus });
            onToast('Status updated', 'success');
            fetchTasks(pagination.page);
        } catch (err) {
            onToast(err.message, 'error');
        }
    };

    const handleSave = async (taskData) => {
        try {
            if (editingTask) {
                await api.updateTask(editingTask._id, taskData);
                onToast('Task updated', 'success');
            } else {
                await api.createTask(taskData);
                onToast('Task created', 'success');
            }
            setShowModal(false);
            fetchTasks(pagination.page);
        } catch (err) {
            onToast(err.message, 'error');
        }
    };

    const statusOptions = ['todo', 'in-progress', 'done'];

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">My Tasks</h1>
                <button className="btn btn-primary" onClick={handleCreate}>
                    + New Task
                </button>
            </div>

            {loading ? (
                <div className="loading"><div className="spinner"></div></div>
            ) : tasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <h3 className="empty-state-title">No tasks yet</h3>
                    <p>Create your first task to get started</p>
                </div>
            ) : (
                <>
                    <div className="tasks-grid">
                        {tasks.map((task) => (
                            <div key={task._id} className="card task-card">
                                <span className={`task-status status-${task.status}`}>
                                    {task.status === 'todo' && '○'}
                                    {task.status === 'in-progress' && '◐'}
                                    {task.status === 'done' && '●'} {task.status}
                                </span>
                                <h3 className="task-title">{task.title}</h3>
                                {task.description && <p className="task-description">{task.description}</p>}
                                <div className="task-meta">
                                    {task.dueDate && <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>}
                                    {task.assignedTo && <span>👤 {task.assignedTo.name}</span>}
                                </div>
                                <div className="task-actions">
                                    <select
                                        className="form-select"
                                        value={task.status}
                                        onChange={(e) => handleStatusChange(task, e.target.value)}
                                        style={{ flex: 1, padding: '0.5rem' }}
                                    >
                                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(task)}>Edit</button>
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task._id)}>×</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {pagination.pages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page === 1}
                                onClick={() => fetchTasks(pagination.page - 1)}
                            >← Prev</button>
                            <span style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                disabled={pagination.page === pagination.pages}
                                onClick={() => fetchTasks(pagination.page + 1)}
                            >Next →</button>
                        </div>
                    )}
                </>
            )}

            {showModal && (
                <TaskModal
                    task={editingTask}
                    onClose={() => setShowModal(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}

function TaskModal({ task, onClose, onSave }) {
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [status, setStatus] = useState(task?.status || 'todo');
    const [assignedTo, setAssignedTo] = useState(task?.assignedTo?._id || '');
    const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] || '');
    const [users, setUsers] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await api.getUsers();
                setUsers(res.data.users);
            } catch (err) {
                console.error('Failed to fetch users', err);
            }
        };
        fetchUsers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        const data = { title, description, status };
        if (dueDate) data.dueDate = new Date(dueDate).toISOString();
        if (assignedTo) data.assignedTo = assignedTo;

        await onSave(data);
        setSaving(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">{task ? 'Edit Task' : 'New Task'}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label">Title *</label>
                            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="todo">Todo</option>
                                <option value="in-progress">In Progress</option>
                                <option value="done">Done</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Assign To</label>
                            <select className="form-select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                                <option value="">Select User (Optional)</option>
                                {users.map(u => (
                                    <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <input type="date" className="form-input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

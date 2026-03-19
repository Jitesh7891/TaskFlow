const API_URL = 'http://localhost:3000';

class ApiService {
    constructor() {
        this.rateLimitRemaining = 60;
        this.rateLimitMax = 60;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    setToken(token) {
        localStorage.setItem('token', token);
    }

    clearToken() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    updateRateLimit(response) {
        const limit = response.headers.get('x-ratelimit-limit');
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (limit) this.rateLimitMax = parseInt(limit);
        if (remaining) this.rateLimitRemaining = parseInt(remaining);
    }

    getRateLimit() {
        return {
            remaining: this.rateLimitRemaining,
            max: this.rateLimitMax,
        };
    }

    async request(endpoint, options = {}) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: this.getHeaders(),
        });

        this.updateRateLimit(response);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    }

    // Auth
    async register(name, email, password) {
        const data = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
        this.setToken(data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return data.data;
    }

    async login(email, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return data.data;
    }

    logout() {
        this.clearToken();
    }

    // Tasks
    async getTasks(page = 1, limit = 10) {
        return this.request(`/tasks?page=${page}&limit=${limit}`);
    }

    async getTask(id) {
        return this.request(`/tasks/${id}`);
    }

    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData),
        });
    }

    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(taskData),
        });
    }

    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE',
        });
    }

    // Notifications
    async getNotifications(page = 1, limit = 20) {
        return this.request(`/notifications?page=${page}&limit=${limit}`);
    }

    // Users
    async getUsers() {
        return this.request('/auth/users');
    }
}

export const api = new ApiService();

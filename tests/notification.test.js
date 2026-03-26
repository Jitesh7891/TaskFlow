const request = require('supertest');
const app = require('../src/app');
const { Notification } = require('../src/models');

describe('Notification Endpoints', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
        const registerRes = await request(app)
            .post('/auth/register')
            .send({
                name: 'Notif User',
                email: 'notifuser@example.com',
                password: 'password123',
            });

        authToken = registerRes.body.data.token;
        userId = registerRes.body.data.user._id;
    });

    describe('GET /notifications', () => {
        it('should require authentication', async () => {
            const res = await request(app).get('/notifications');

            expect(res.status).toBe(401);
        });

        it('should return empty list when user has no notifications', async () => {
            const res = await request(app)
                .get('/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.notifications).toHaveLength(0);
            expect(res.body.data.pagination.total).toBe(0);
        });

        it('should return notifications for the authenticated user', async () => {
            // Create a task so we have a valid taskId reference
            const taskRes = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Notif Task' });

            const taskId = taskRes.body.data.task._id;

            // Seed notifications directly in DB
            await Notification.create([
                {
                    userId,
                    type: 'TASK_ASSIGNED',
                    message: 'You were assigned task 1',
                    taskId,
                },
                {
                    userId,
                    type: 'STATUS_UPDATED',
                    message: 'Task status changed',
                    taskId,
                },
            ]);

            const res = await request(app)
                .get('/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.notifications).toHaveLength(2);
            expect(res.body.data.pagination.total).toBe(2);
        });

        it('should support pagination', async () => {
            const taskRes = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Paginated Task' });

            const taskId = taskRes.body.data.task._id;

            // Create 3 notifications
            await Notification.create([
                { userId, type: 'TASK_ASSIGNED', message: 'Notification 1', taskId },
                { userId, type: 'TASK_ASSIGNED', message: 'Notification 2', taskId },
                { userId, type: 'STATUS_UPDATED', message: 'Notification 3', taskId },
            ]);

            const res = await request(app)
                .get('/notifications?page=1&limit=2')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.notifications).toHaveLength(2);
            expect(res.body.data.pagination.total).toBe(3);
            expect(res.body.data.pagination.pages).toBe(2);
            expect(res.body.data.pagination.page).toBe(1);
            expect(res.body.data.pagination.limit).toBe(2);
        });

        it('should not return notifications belonging to other users', async () => {
            // Create a second user
            const user2Res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Other User',
                    email: 'other@example.com',
                    password: 'password123',
                });

            const user2Id = user2Res.body.data.user._id;

            const taskRes = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Isolated Task' });

            const taskId = taskRes.body.data.task._id;

            // Create notification for user2, NOT the authenticated user
            await Notification.create({
                userId: user2Id,
                type: 'TASK_ASSIGNED',
                message: 'This is for user2 only',
                taskId,
            });

            const res = await request(app)
                .get('/notifications')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.notifications).toHaveLength(0);
        });
    });
});

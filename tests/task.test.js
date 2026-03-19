const request = require('supertest');
const app = require('../src/app');
const { getNotificationQueue } = require('../src/config/queue');

describe('Task Endpoints', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
        // Register and login to get token
        const registerRes = await request(app)
            .post('/auth/register')
            .send({
                name: 'Task User',
                email: 'taskuser@example.com',
                password: 'password123',
            });

        authToken = registerRes.body.data.token;
        userId = registerRes.body.data.user._id;
    });

    describe('POST /tasks', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .post('/tasks')
                .send({ title: 'Test Task' });

            expect(res.status).toBe(401);
        });

        it('should create a task successfully', async () => {
            const taskData = {
                title: 'New Task',
                description: 'Task description',
                status: 'todo',
            };

            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send(taskData);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.task.title).toBe(taskData.title);
            expect(res.body.data.task.description).toBe(taskData.description);
            expect(res.body.data.task.createdBy).toBe(userId);
        });

        it('should fail without title', async () => {
            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ description: 'No title' });

            expect(res.status).toBe(400);
        });

        it('should trigger notification queue when task is assigned', async () => {
            // Create another user to assign to
            const user2Res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Assignee',
                    email: 'assignee@example.com',
                    password: 'password123',
                });

            const assigneeId = user2Res.body.data.user._id;
            const mockQueue = getNotificationQueue();

            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Assigned Task',
                    assignedTo: assigneeId,
                });

            expect(res.status).toBe(201);
            expect(mockQueue.add).toHaveBeenCalledWith(
                'task_assigned',
                expect.objectContaining({
                    type: 'TASK_ASSIGNED',
                    userId: assigneeId,
                })
            );
        });
    });

    describe('GET /tasks', () => {
        beforeEach(async () => {
            // Create some tasks
            await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Task 1' });

            await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Task 2' });
        });

        it('should return list of tasks', async () => {
            const res = await request(app)
                .get('/tasks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data.tasks).toHaveLength(2);
            expect(res.body.data.pagination).toBeDefined();
            expect(res.body.data.pagination.total).toBe(2);
        });

        it('should support pagination', async () => {
            const res = await request(app)
                .get('/tasks?page=1&limit=1')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.tasks).toHaveLength(1);
            expect(res.body.data.pagination.pages).toBe(2);
        });
    });

    describe('GET /tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Single Task' });

            taskId = res.body.data.task._id;
        });

        it('should return a single task', async () => {
            const res = await request(app)
                .get(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.task._id).toBe(taskId);
        });

        it('should return 404 for non-existent task', async () => {
            const res = await request(app)
                .get('/tasks/000000000000000000000000')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Update Task', status: 'todo' });

            taskId = res.body.data.task._id;
        });

        it('should update task as creator', async () => {
            const res = await request(app)
                .patch(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'in-progress' });

            expect(res.status).toBe(200);
            expect(res.body.data.task.status).toBe('in-progress');
        });

        it('should reject update from non-creator/non-assignee', async () => {
            // Create another user
            const user2Res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Other User',
                    email: 'other@example.com',
                    password: 'password123',
                });

            const res = await request(app)
                .patch(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${user2Res.body.data.token}`)
                .send({ status: 'done' });

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Delete Task' });

            taskId = res.body.data.task._id;
        });

        it('should delete task as creator', async () => {
            const res = await request(app)
                .delete(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);

            // Verify deletion
            const getRes = await request(app)
                .get(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getRes.status).toBe(404);
        });

        it('should reject delete from non-creator', async () => {
            const user2Res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Other User',
                    email: 'other@example.com',
                    password: 'password123',
                });

            const res = await request(app)
                .delete(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${user2Res.body.data.token}`);

            expect(res.status).toBe(403);
        });
    });
});

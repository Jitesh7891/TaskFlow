const request = require('supertest');
const app = require('../src/app');
const { User } = require('../src/models');

describe('Auth Endpoints', () => {
    describe('POST /auth/register', () => {
        it('should register a new user successfully', async () => {
            const userData = {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            };

            const res = await request(app)
                .post('/auth/register')
                .send(userData);

            expect(res.status).toBe(201);
            expect(res.body.status).toBe('success');
            expect(res.body.data.user).toHaveProperty('_id');
            expect(res.body.data.user.email).toBe(userData.email);
            expect(res.body.data.user.name).toBe(userData.name);
            expect(res.body.data.user).not.toHaveProperty('passwordHash');
            expect(res.body.data).toHaveProperty('token');
        });

        it('should fail with duplicate email', async () => {
            const userData = {
                name: 'Test User',
                email: 'duplicate@example.com',
                password: 'password123',
            };

            // Create first user
            await request(app).post('/auth/register').send(userData);

            // Try to create duplicate
            const res = await request(app)
                .post('/auth/register')
                .send(userData);

            expect(res.status).toBe(409);
            expect(res.body.status).toBe('fail');
        });

        it('should fail with invalid email', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Test User',
                    email: 'invalid-email',
                    password: 'password123',
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Validation error');
        });

        it('should fail with short password', async () => {
            const res = await request(app)
                .post('/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: '123',
                });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /auth/login', () => {
        beforeEach(async () => {
            await request(app)
                .post('/auth/register')
                .send({
                    name: 'Test User',
                    email: 'login@example.com',
                    password: 'password123',
                });
        });

        it('should login successfully and return JWT token', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'password123',
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.data).toHaveProperty('token');
            expect(res.body.data.user.email).toBe('login@example.com');
        });

        it('should fail with wrong password', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'wrongpassword',
                });

            expect(res.status).toBe(401);
            expect(res.body.message).toBe('Invalid email or password');
        });

        it('should fail with non-existent email', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123',
                });

            expect(res.status).toBe(401);
        });
    });

    describe('Auth Edge Cases', () => {
        describe('POST /auth/register - missing fields', () => {
            it('should fail when name is missing', async () => {
                const res = await request(app)
                    .post('/auth/register')
                    .send({ email: 'test@example.com', password: 'password123' });

                expect(res.status).toBe(400);
            });

            it('should fail when email is missing', async () => {
                const res = await request(app)
                    .post('/auth/register')
                    .send({ name: 'Test User', password: 'password123' });

                expect(res.status).toBe(400);
            });

            it('should fail when password is missing', async () => {
                const res = await request(app)
                    .post('/auth/register')
                    .send({ name: 'Test User', email: 'test@example.com' });

                expect(res.status).toBe(400);
            });

            it('should fail with empty body', async () => {
                const res = await request(app)
                    .post('/auth/register')
                    .send({});

                expect(res.status).toBe(400);
            });
        });

        describe('POST /auth/login - missing fields', () => {
            it('should fail when email is missing', async () => {
                const res = await request(app)
                    .post('/auth/login')
                    .send({ password: 'password123' });

                expect(res.status).toBe(400);
            });

            it('should fail when password is missing', async () => {
                const res = await request(app)
                    .post('/auth/login')
                    .send({ email: 'test@example.com' });

                expect(res.status).toBe(400);
            });

            it('should fail with empty body', async () => {
                const res = await request(app)
                    .post('/auth/login')
                    .send({});

                expect(res.status).toBe(400);
            });
        });

        describe('JWT token structure', () => {
            it('should return a token with 3 parts (header.payload.signature)', async () => {
                const res = await request(app)
                    .post('/auth/register')
                    .send({
                        name: 'JWT User',
                        email: 'jwt@example.com',
                        password: 'password123',
                    });

                expect(res.status).toBe(201);

                const token = res.body.data.token;
                expect(token).toBeDefined();

                const parts = token.split('.');
                expect(parts).toHaveLength(3);

                // Each part should be a non-empty base64url string
                parts.forEach(part => {
                    expect(part.length).toBeGreaterThan(0);
                });
            });
        });
    });
});

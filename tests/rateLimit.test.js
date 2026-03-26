const request = require('supertest');
const app = require('../src/app');
const { getRedisClient } = require('../src/config/redis');

describe('Rate Limiting', () => {
    it('should return 429 after exceeding global rate limit', async () => {
        const mockRedis = getRedisClient();

        // Setup mock to simulate global rate limit exceeded
        mockRedis.get.mockResolvedValue('100'); // At limit

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Too many requests');
    });

    it('should allow generic requests under the global limit', async () => {
        const mockRedis = getRedisClient();

        // Setup mock to simulate under limit
        mockRedis.get.mockResolvedValue('5'); // Well under 100 limit

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(200);
        expect(res.headers).toHaveProperty('x-ratelimit-limit');
        expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    });

    it('should return 429 for Auth endpoints strictly after 10 requests', async () => {
        const mockRedis = getRedisClient();

        // Return 10 hits. Global limit (100) will pass. Auth limit (10) will block it.
        mockRedis.get.mockResolvedValue('10');

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'password' });

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Too many requests');
    });

    it('should show stateful transition from 200 → 429 as request count increases', async () => {
        const mockRedis = getRedisClient();

        // Simulate an incrementing counter: each call to redis.get returns a higher count
        let callCount = 0;
        mockRedis.get.mockImplementation(() => {
            callCount++;
            // Return the current accumulated count as a string
            return Promise.resolve(String(callCount));
        });

        // First few requests should succeed (under the 100 global limit)
        for (let i = 0; i < 3; i++) {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
        }

        // Now simulate that the counter has crossed the limit
        mockRedis.get.mockResolvedValue('100'); // At global limit (100)

        const blockedRes = await request(app).get('/health');
        expect(blockedRes.status).toBe(429);
        expect(blockedRes.body.message).toContain('Too many requests');
    });

    it('should show stateful transition from 200 → 429 on auth route with lower limit', async () => {
        const mockRedis = getRedisClient();

        // Auth has 10 request limit. Simulate incrementing counter.
        let authCallCount = 0;
        mockRedis.get.mockImplementation(() => {
            authCallCount++;
            return Promise.resolve(String(authCallCount));
        });

        // First request should succeed (count=1, under both global 100 and auth 10)
        const successRes = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'test' });

        // It won't be 429 at count=1 (under the auth limit of 10)
        expect(successRes.status).not.toBe(429);

        // Jump ahead to simulate limit exceeded
        mockRedis.get.mockResolvedValue('10'); // At auth limit

        const blockedRes = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'test' });

        expect(blockedRes.status).toBe(429);
    });
});

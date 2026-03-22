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
});

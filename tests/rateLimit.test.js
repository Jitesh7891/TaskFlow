const request = require('supertest');
const app = require('../src/app');
const { getRedisClient } = require('../src/config/redis');

describe('Rate Limiting', () => {
    it('should return 429 after exceeding rate limit', async () => {
        const mockRedis = getRedisClient();

        // Setup mock to simulate rate limit exceeded
        mockRedis.get.mockResolvedValue('60'); // Already at limit

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Too many requests');
    });

    it('should allow requests under the limit', async () => {
        const mockRedis = getRedisClient();

        // Setup mock to simulate under limit
        mockRedis.get.mockResolvedValue('5'); // Well under limit

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(200);
        expect(res.headers).toHaveProperty('x-ratelimit-limit');
        expect(res.headers).toHaveProperty('x-ratelimit-remaining');
    });
});

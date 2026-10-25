const request = require('supertest');
const app = require('../src/app');
const { getRedisClient } = require('../src/config/redis');
const { fixedWindowRateLimitScript } = require('../src/middlewares/rateLimiter');

describe('Rate Limiting', () => {
    it('uses an atomic fixed-window Redis script', () => {
        expect(fixedWindowRateLimitScript).toContain("redis.call('GET'");
        expect(fixedWindowRateLimitScript).toContain("redis.call('INCR'");
        expect(fixedWindowRateLimitScript).toContain('if newCount == 1 then');
        expect(fixedWindowRateLimitScript).toContain("redis.call('PEXPIRE'");
    });

    it('should return 429 after exceeding global rate limit', async () => {
        const mockRedis = getRedisClient();

        mockRedis.eval.mockResolvedValue([0, 60, 45000]);

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Too many requests');
        expect(res.headers['x-ratelimit-remaining']).toBe('0');
        expect(res.headers['retry-after']).toBe('45');
    });

    it('should allow generic requests under the global limit', async () => {
        const mockRedis = getRedisClient();

        mockRedis.eval.mockResolvedValue([1, 6, 60000]);

        const res = await request(app)
            .get('/health');

        expect(res.status).toBe(200);
        expect(res.headers).toHaveProperty('x-ratelimit-limit');
        expect(res.headers).toHaveProperty('x-ratelimit-remaining');
        expect(res.headers['x-ratelimit-remaining']).toBe('54');
        expect(mockRedis.eval).toHaveBeenCalledWith(
            fixedWindowRateLimitScript,
            1,
            expect.stringMatching(/^ratelimit:/),
            60000,
            60
        );
    });

    it('should return 429 for Auth endpoints strictly after 10 requests', async () => {
        const mockRedis = getRedisClient();

        // The global limiter passes first; the stricter auth limiter then blocks.
        mockRedis.eval
            .mockResolvedValueOnce([1, 1, 60000])
            .mockResolvedValueOnce([0, 10, 12000]);

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'password' });

        expect(res.status).toBe(429);
        expect(res.body.message).toContain('Too many requests');
        expect(res.headers['retry-after']).toBe('12');
    });

    it('should honor an atomic result during concurrent requests', async () => {
        const mockRedis = getRedisClient();

        // The mock represents the result returned by Redis's atomic script.
        let callCount = 0;
        mockRedis.eval.mockImplementation(() => {
            callCount++;
            return Promise.resolve(callCount <= 60
                ? [1, callCount, 60000]
                : [0, 60, 60000]);
        });

        const responses = await Promise.all(
            Array.from({ length: 65 }, () => request(app).get('/health'))
        );

        expect(responses.filter((res) => res.status === 200)).toHaveLength(60);
        expect(responses.filter((res) => res.status === 429)).toHaveLength(5);
    });

    it('keeps the fixed-window TTL instead of resetting it on later requests', async () => {
        const mockRedis = getRedisClient();

        mockRedis.eval
            .mockResolvedValueOnce([1, 1, 60000])
            .mockResolvedValueOnce([1, 2, 10000]);

        await request(app).get('/health');
        await request(app).get('/health');

        expect(mockRedis.eval.mock.calls[0][3]).toBe(60000);
        expect(mockRedis.eval.mock.calls[1][3]).toBe(60000);
        expect(mockRedis.eval.mock.calls[1][0]).toBe(fixedWindowRateLimitScript);
    });
});

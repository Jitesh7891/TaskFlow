const cacheService = require('../src/services/cacheService');
const { getRedisClient } = require('../src/config/redis');

describe('CacheService Unit Tests', () => {
    let mockRedis;

    beforeEach(() => {
        mockRedis = getRedisClient();
        jest.clearAllMocks();
    });

    describe('get()', () => {
        it('should return null on cache miss', async () => {
            mockRedis.get.mockResolvedValue(null);

            const result = await cacheService.get('task:nonexistent');

            expect(result).toBeNull();
            expect(mockRedis.get).toHaveBeenCalledWith('task:nonexistent');
        });

        it('should return parsed JSON on cache hit', async () => {
            const cachedData = { _id: 'task123', title: 'Cached Task' };
            mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

            const result = await cacheService.get('task:task123');

            expect(result).toEqual(cachedData);
            expect(mockRedis.get).toHaveBeenCalledWith('task:task123');
        });

        it('should return null and not throw on Redis error', async () => {
            mockRedis.get.mockRejectedValue(new Error('Redis connection lost'));

            const result = await cacheService.get('task:broken');

            expect(result).toBeNull();
        });
    });

    describe('set()', () => {
        it('should call setex with default TTL (60s) and serialized data', async () => {
            const data = { _id: 'task456', title: 'New Task' };

            await cacheService.set('task:task456', data);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'task:task456',
                60,
                JSON.stringify(data)
            );
        });

        it('should accept a custom TTL', async () => {
            const data = { _id: 'task789' };

            await cacheService.set('task:task789', data, 300);

            expect(mockRedis.setex).toHaveBeenCalledWith(
                'task:task789',
                300,
                JSON.stringify(data)
            );
        });

        it('should not throw on Redis error', async () => {
            mockRedis.setex.mockRejectedValue(new Error('Redis write error'));

            await expect(cacheService.set('key', { data: true })).resolves.not.toThrow();
        });
    });

    describe('delete()', () => {
        it('should call redis.del with the correct key', async () => {
            await cacheService.delete('task:task123');

            expect(mockRedis.del).toHaveBeenCalledWith('task:task123');
        });

        it('should not throw on Redis error', async () => {
            mockRedis.del.mockRejectedValue(new Error('Redis delete error'));

            await expect(cacheService.delete('key')).resolves.not.toThrow();
        });
    });

    describe('invalidateUserTaskCache()', () => {
        it('should scan and delete all matching keys for a user', async () => {
            // Simulate SCAN returning keys on first call, then cursor '0' to stop
            mockRedis.scan
                .mockResolvedValueOnce(['0', ['tasks:user:u1:page:1:limit:10', 'tasks:user:u1:page:2:limit:10']]);

            await cacheService.invalidateUserTaskCache('u1');

            expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'tasks:user:u1:*', 'COUNT', 100);
            expect(mockRedis.del).toHaveBeenCalledWith(
                'tasks:user:u1:page:1:limit:10',
                'tasks:user:u1:page:2:limit:10'
            );
        });

        it('should handle SCAN returning no keys', async () => {
            mockRedis.scan.mockResolvedValueOnce(['0', []]);

            await cacheService.invalidateUserTaskCache('u2');

            expect(mockRedis.scan).toHaveBeenCalled();
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it('should not throw on Redis error', async () => {
            mockRedis.scan.mockRejectedValue(new Error('Redis scan error'));

            await expect(cacheService.invalidateUserTaskCache('u3')).resolves.not.toThrow();
        });
    });

    describe('invalidateTaskCache()', () => {
        it('should delete single task cache and invalidate all affected users', async () => {
            mockRedis.scan.mockResolvedValue(['0', []]);

            await cacheService.invalidateTaskCache('task999', ['userA', 'userB']);

            // Should delete the individual task key
            expect(mockRedis.del).toHaveBeenCalledWith('task:task999');

            // Should scan for each affected user
            expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'tasks:user:userA:*', 'COUNT', 100);
            expect(mockRedis.scan).toHaveBeenCalledWith('0', 'MATCH', 'tasks:user:userB:*', 'COUNT', 100);
        });

        it('should work with no affected users', async () => {
            await cacheService.invalidateTaskCache('task000', []);

            expect(mockRedis.del).toHaveBeenCalledWith('task:task000');
            expect(mockRedis.scan).not.toHaveBeenCalled();
        });
    });

    describe('Key generation helpers', () => {
        it('getTaskListKey should return correct format', () => {
            const key = cacheService.getTaskListKey('user1', 2, 20);
            expect(key).toBe('tasks:user:user1:page:2:limit:20');
        });

        it('getTaskKey should return correct format', () => {
            const key = cacheService.getTaskKey('abc123');
            expect(key).toBe('task:abc123');
        });
    });
});

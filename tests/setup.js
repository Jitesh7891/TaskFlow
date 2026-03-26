const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Mock Redis client
jest.mock('../src/config/redis', () => {
    const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        setex: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        scan: jest.fn().mockResolvedValue(['0', []]),
        incr: jest.fn().mockResolvedValue(1),
        pexpire: jest.fn().mockResolvedValue(1),
        multi: jest.fn(() => ({
            incr: jest.fn().mockReturnThis(),
            pexpire: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
        })),
        quit: jest.fn().mockResolvedValue('OK'),
        on: jest.fn(),
    };

    return {
        getRedisClient: jest.fn(() => mockRedis),
        closeRedis: jest.fn().mockResolvedValue(undefined),
    };
});

// Mock BullMQ Queue
jest.mock('../src/config/queue', () => {
    const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
        close: jest.fn().mockResolvedValue(undefined),
    };

    return {
        getNotificationQueue: jest.fn(() => mockQueue),
        closeQueue: jest.fn().mockResolvedValue(undefined),
    };
});

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1d';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_MAX_REQUESTS = '60';

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        await collections[key].deleteMany({});
    }
    jest.clearAllMocks();
});

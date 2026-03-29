// Load .env so REDIS_URL is available (tests don't go through server.js where dotenv is normally called)
require('dotenv').config();

// Unmock the global setup.js mocks so we can use REAL Redis and Real BullMQ
jest.unmock('../src/config/redis');
jest.unmock('../src/config/queue');

const { Queue, Worker } = require('bullmq');
const { getRedisClient, closeRedis } = require('../src/config/redis');

// We use a unique queue name so it doesn't interfere with the dev environment
const QUEUE_NAME = `test-integration-queue-${Date.now()}`;

describe('BullMQ True Integration Tests', () => {
    let queue;
    let worker;

    const connectionInfo = process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : { host: 'localhost', port: 6379 };

    beforeAll(async () => {
        queue = new Queue(QUEUE_NAME, { connection: connectionInfo });
    });

    afterAll(async () => {
        await queue.obliterate({ force: true });
        await queue.close();
        if (worker) {
            await worker.close();
            await worker.disconnect();
        }

        // Wait briefly for all sockets to close down completely to prevent ECONNRESET warnings in jest
        await new Promise(r => setTimeout(r, 500));
    });

    afterEach(async () => {
        if (worker) {
            await worker.close();
            await worker.disconnect();
            worker = null;
        }
        await queue.obliterate({ force: true });
        jest.clearAllMocks();
    });

    it('[Idempotency] should completely ignore jobs that share the same jobId', async () => {
        const jobId = 'idempotent-key-123';
        let processCount = 0;

        // 1. Create a worker that simply counts how many times a job is processed
        worker = new Worker(QUEUE_NAME, async (job) => {
            processCount++;
            return { success: true };
        }, { connection: connectionInfo });

        // 2. Add the EXACT SAME job 5 times concurrently with the same jobId
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(
                queue.add('test_job', { data: 'test' }, { jobId })
            );
        }

        await Promise.all(promises);

        // 3. Wait for the queue to finish processing
        await new Promise((resolve) => {
            worker.on('completed', () => {
                setTimeout(resolve, 500); // give it time to accidentally process duplicates if it were going to
            });
        });

        // 4. Assert that despite adding it 5 times, it only processed EXACTLY 1 time!
        expect(processCount).toBe(1);
    }, 10000);

    it('[Retries] should retry the exact amount of times before permanent failure', async () => {
        let attemptsObserved = 0;
        let permanentFailureCaught = false;

        worker = new Worker(QUEUE_NAME, async (job) => {
            attemptsObserved++;
            throw new Error('Simulated external API timeout');
        }, { connection: connectionInfo });

        // Listen for the failed event (similar to worker/index.js logic)
        worker.on('failed', (job, err) => {
            const attemptsMade = job.attemptsMade;
            const maxAttempts = job.opts.attempts;

            if (attemptsMade >= maxAttempts) {
                permanentFailureCaught = true;
            }
        });

        // Add a job with 3 attempts and a super fast backoff (so the test runs quickly)
        await queue.add('fail_job', { data: 'fail' }, {
            attempts: 3,
            backoff: { type: 'fixed', delay: 100 }
        });

        // Wait for the total lifecycle to fail permanently 
        // (1st try + 2 retries = 3 attempts total)
        await new Promise((resolve) => {
            const interval = setInterval(() => {
                if (permanentFailureCaught) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        // The worker should have literally executed the function exactly 3 times
        expect(attemptsObserved).toBe(3);
        expect(permanentFailureCaught).toBe(true);
    }, 10000);

    it('[DLQ] should move job to DLQ after permanent failure and process it exactly once', async () => {
        let attemptsObserved = 0;
        let permanentFailureCaught = false;
        let dlqAttemptsObserved = 0;

        // Main worker
        worker = new Worker(QUEUE_NAME, async (job) => {
            attemptsObserved++;
            throw new Error('Simulated external API timeout');
        }, { connection: connectionInfo });

        const DLQ_QUEUE_NAME = `dlq-${QUEUE_NAME}`;
        const dlqQueue = new Queue(DLQ_QUEUE_NAME, { connection: connectionInfo });

        let dlqWorker = new Worker(DLQ_QUEUE_NAME, async (job) => {
            dlqAttemptsObserved++;
            return { success: true }; // Recovered in DLQ
        }, { connection: connectionInfo });

        // Listen for the failed event and move to DLQ manually as worker/index.js does
        worker.on('failed', async (job, err) => {
            const attemptsMade = job.attemptsMade;
            const maxAttempts = job.opts.attempts;

            if (attemptsMade >= maxAttempts) {
                permanentFailureCaught = true;
                await dlqQueue.add(job.name, job.data, {
                    attempts: 1
                });
            }
        });

        // Add a job with 3 attempts and a super fast backoff
        await queue.add('fail_job', { data: 'fail' }, {
            attempts: 3,
            backoff: { type: 'fixed', delay: 100 }
        });

        // Wait for DLQ processing
        await new Promise((resolve) => {
            dlqWorker.on('completed', () => {
                resolve();
            });
        });

        // Assertions
        expect(attemptsObserved).toBe(3);
        expect(permanentFailureCaught).toBe(true);
        expect(dlqAttemptsObserved).toBe(1);

        await dlqWorker.close();
        await dlqQueue.close();
    }, 10000);

    it('[Observability] should log retries and permanent failure correctly', async () => {
        let logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        let warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

        let attemptsObserved = 0;
        let permanentFailureCaught = false;

        worker = new Worker(QUEUE_NAME, async (job) => {
            attemptsObserved++;
            throw new Error('Simulated failure');
        }, { connection: connectionInfo });

        // Wait until final failure
        await new Promise((resolve) => {
            // Simulate your worker failure handling logic
            worker.on('failed', (job, err) => {
                const attemptsMade = job.attemptsMade;
                const maxAttempts = job.opts.attempts;

                if (attemptsMade < maxAttempts) {
                    console.warn(`[WARN] Job retrying (${attemptsMade}/${maxAttempts})`);
                } else {
                    console.log(`[DEAD LETTER] Job failed permanently`);
                    permanentFailureCaught = true;
                    resolve();
                }
            });

            queue.add('fail_job', {}, {
                attempts: 3,
                backoff: { type: 'fixed', delay: 100 }
            });
        });

        // Assertions
        expect(attemptsObserved).toBe(3);
        expect(warnSpy).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('DEAD LETTER')
        );

        // cleanup spies
        logSpy.mockRestore();
        warnSpy.mockRestore();
    }, 10000);
});

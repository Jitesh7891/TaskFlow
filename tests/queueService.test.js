const queueService = require('../src/services/queueService');
const { getNotificationQueue } = require('../src/config/queue');

describe('Queue Service Background Jobs', () => {
    let mockQueue;

    beforeEach(() => {
        mockQueue = getNotificationQueue();
        jest.clearAllMocks();
    });

    describe('addTaskAssignedJob', () => {
        it('should add a job with the correct idempotency key and retry logic', async () => {
            const taskId = 'task123';
            const assignedToUserId = 'user456';
            
            await queueService.addTaskAssignedJob(taskId, assignedToUserId, 'Test Task', 'Assigner Name');

            expect(mockQueue.add).toHaveBeenCalledTimes(1);
            
            // Check the exact arguments passed to mockQueue.add()
            const [jobName, jobData, jobOptions] = mockQueue.add.mock.calls[0];
            
            expect(jobName).toBe('task_assigned');
            expect(jobData.type).toBe('TASK_ASSIGNED');
            expect(jobData.taskId).toBe(taskId);
            expect(jobData.userId).toBe(assignedToUserId);
            
            // Critical check for Reliability details added in the user flow
            expect(jobOptions).toBeDefined();
            expect(jobOptions.jobId).toBe(`task_assigned:${taskId}:${assignedToUserId}`);
            expect(jobOptions.attempts).toBe(3);
            expect(jobOptions.backoff).toEqual({ type: 'exponential', delay: 1000 });
            expect(jobOptions.removeOnComplete).toBe(true);
        });
    });

    describe('addStatusUpdatedJob', () => {
        it('should add a job with the correct idempotency key and retry logic', async () => {
            const taskId = 'task789';
            const userId = 'user012';
            
            await queueService.addStatusUpdatedJob(taskId, userId, 'Status Task', 'todo', 'done');

            expect(mockQueue.add).toHaveBeenCalledTimes(1);
            
            const [jobName, jobData, jobOptions] = mockQueue.add.mock.calls[0];
            
            expect(jobName).toBe('task_status_updated');
            expect(jobData.type).toBe('STATUS_UPDATED');
            
            // Critical check for Reliability details
            expect(jobOptions).toBeDefined();
            expect(jobOptions.jobId).toBe(`status_update:${taskId}:done`);
            expect(jobOptions.attempts).toBe(3);
            expect(jobOptions.backoff).toEqual({ type: 'exponential', delay: 1000 });
            expect(jobOptions.removeOnComplete).toBe(true);
        });
    });
});

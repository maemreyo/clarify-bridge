import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { Queue, Job, JobOptions } from 'bull';
import { JobQueueService, QueueName, JobType, JobData, JobResult } from './job-queue.service';

describe('JobQueueService', () => {
  let service: JobQueueService;
  let specificationQueue: jest.Mocked<Queue<JobData>>;
  let notificationQueue: jest.Mocked<Queue<JobData>>;
  let analyticsQueue: jest.Mocked<Queue<JobData>>;

  const mockJob: Job<JobData> = {
    id: 'job-123',
    data: {
      type: JobType.GENERATE_SPECIFICATION,
      payload: { test: 'data' },
      userId: 'user-123',
    },
    opts: {},
    progress: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    retry: jest.fn(),
    discard: jest.fn(),
    finished: jest.fn(),
    moveToCompleted: jest.fn(),
    moveToFailed: jest.fn(),
    promote: jest.fn(),
    isCompleted: jest.fn(),
    isFailed: jest.fn(),
    isDelayed: jest.fn(),
    isActive: jest.fn(),
    isWaiting: jest.fn(),
    isPaused: jest.fn(),
  } as any;

  const createMockQueue = (): jest.Mocked<Queue<JobData>> =>
    ({
      add: jest.fn(),
      addBulk: jest.fn(),
      getJob: jest.fn(),
      getWaitingCount: jest.fn(),
      getActiveCount: jest.fn(),
      getCompletedCount: jest.fn(),
      getFailedCount: jest.fn(),
      getDelayedCount: jest.fn(),
      getPausedCount: jest.fn(),
      clean: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      client: {
        ping: jest.fn(),
        info: jest.fn(),
      },
    }) as any;

  beforeEach(async () => {
    specificationQueue = createMockQueue();
    notificationQueue = createMockQueue();
    analyticsQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobQueueService,
        {
          provide: getQueueToken(QueueName.SPECIFICATION),
          useValue: specificationQueue,
        },
        {
          provide: getQueueToken(QueueName.NOTIFICATION),
          useValue: notificationQueue,
        },
        {
          provide: getQueueToken(QueueName.ANALYTICS),
          useValue: analyticsQueue,
        },
      ],
    }).compile();

    service = module.get<JobQueueService>(JobQueueService);
    jest.clearAllMocks();
  });

  describe('addJob', () => {
    it('should add job to specification queue with default options', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.GENERATE_SPECIFICATION,
        payload: { title: 'Test Spec' },
        userId: 'user-123',
      };
      specificationQueue.add.mockResolvedValue(mockJob);

      // Act
      const result = await service.addJob(QueueName.SPECIFICATION, jobData);

      // Assert
      expect(specificationQueue.add).toHaveBeenCalledWith(
        jobData.type,
        jobData,
        expect.objectContaining({
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }),
      );
      expect(result).toEqual(mockJob);
    });

    it('should add job to notification queue with custom options', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.SEND_EMAIL,
        payload: { template: 'welcome' },
      };
      const customOptions: JobOptions = {
        delay: 10000,
        priority: 1,
      };
      notificationQueue.add.mockResolvedValue(mockJob);

      // Act
      const result = await service.addJob(QueueName.NOTIFICATION, jobData, customOptions);

      // Assert
      expect(notificationQueue.add).toHaveBeenCalledWith(
        jobData.type,
        jobData,
        expect.objectContaining({
          ...customOptions,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        }),
      );
      expect(result).toEqual(mockJob);
    });

    it('should add job to analytics queue', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.TRACK_EVENT,
        payload: { event: 'user_signup' },
      };
      analyticsQueue.add.mockResolvedValue(mockJob);

      // Act
      const result = await service.addJob(QueueName.ANALYTICS, jobData);

      // Assert
      expect(analyticsQueue.add).toHaveBeenCalled();
      expect(result).toEqual(mockJob);
    });

    it('should throw error for unknown queue', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.GENERATE_SPECIFICATION,
        payload: {},
      };

      // Act & Assert
      await expect(service.addJob('unknown' as QueueName, jobData)).rejects.toThrow(
        'Unknown queue: unknown',
      );
    });
  });

  describe('addBulkJobs', () => {
    it('should add multiple jobs to queue', async () => {
      // Arrange
      const jobs = [
        {
          data: {
            type: JobType.GENERATE_SPECIFICATION,
            payload: { id: 1 },
          } as JobData,
        },
        {
          data: {
            type: JobType.UPDATE_SPECIFICATION,
            payload: { id: 2 },
          } as JobData,
          options: { priority: 1 },
        },
      ];
      const mockBulkJobs = [mockJob, { ...mockJob, id: 'job-456' }];
      specificationQueue.addBulk.mockResolvedValue(mockBulkJobs);

      // Act
      const result = await service.addBulkJobs(QueueName.SPECIFICATION, jobs);

      // Assert
      expect(specificationQueue.addBulk).toHaveBeenCalledWith([
        {
          name: JobType.GENERATE_SPECIFICATION,
          data: jobs[0].data,
          opts: undefined,
        },
        {
          name: JobType.UPDATE_SPECIFICATION,
          data: jobs[1].data,
          opts: { priority: 1 },
        },
      ]);
      expect(result).toEqual(mockBulkJobs);
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', async () => {
      // Arrange
      const jobId = 'job-123';
      specificationQueue.getJob.mockResolvedValue(mockJob);

      // Act
      const result = await service.getJob(QueueName.SPECIFICATION, jobId);

      // Assert
      expect(specificationQueue.getJob).toHaveBeenCalledWith(jobId);
      expect(result).toEqual(mockJob);
    });

    it('should return null if job not found', async () => {
      // Arrange
      specificationQueue.getJob.mockResolvedValue(null);

      // Act
      const result = await service.getJob(QueueName.SPECIFICATION, 'non-existent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getJobStatus', () => {
    it('should return completed status', async () => {
      // Arrange
      const completedJob = {
        ...mockJob,
        isCompleted: jest.fn().mockResolvedValue(true),
        isFailed: jest.fn().mockResolvedValue(false),
        isDelayed: jest.fn().mockResolvedValue(false),
        isActive: jest.fn().mockResolvedValue(false),
        isWaiting: jest.fn().mockResolvedValue(false),
        isPaused: jest.fn().mockResolvedValue(false),
      };
      specificationQueue.getJob.mockResolvedValue(completedJob);

      // Act
      const status = await service.getJobStatus(QueueName.SPECIFICATION, 'job-123');

      // Assert
      expect(status).toBe('completed');
    });

    it('should return failed status', async () => {
      // Arrange
      const failedJob = {
        ...mockJob,
        isCompleted: jest.fn().mockResolvedValue(false),
        isFailed: jest.fn().mockResolvedValue(true),
        isDelayed: jest.fn().mockResolvedValue(false),
        isActive: jest.fn().mockResolvedValue(false),
        isWaiting: jest.fn().mockResolvedValue(false),
        isPaused: jest.fn().mockResolvedValue(false),
      };
      specificationQueue.getJob.mockResolvedValue(failedJob);

      // Act
      const status = await service.getJobStatus(QueueName.SPECIFICATION, 'job-123');

      // Assert
      expect(status).toBe('failed');
    });

    it('should return active status', async () => {
      // Arrange
      const activeJob = {
        ...mockJob,
        isCompleted: jest.fn().mockResolvedValue(false),
        isFailed: jest.fn().mockResolvedValue(false),
        isDelayed: jest.fn().mockResolvedValue(false),
        isActive: jest.fn().mockResolvedValue(true),
        isWaiting: jest.fn().mockResolvedValue(false),
        isPaused: jest.fn().mockResolvedValue(false),
      };
      specificationQueue.getJob.mockResolvedValue(activeJob);

      // Act
      const status = await service.getJobStatus(QueueName.SPECIFICATION, 'job-123');

      // Assert
      expect(status).toBe('active');
    });

    it('should return not_found for non-existent job', async () => {
      // Arrange
      specificationQueue.getJob.mockResolvedValue(null);

      // Act
      const status = await service.getJobStatus(QueueName.SPECIFICATION, 'non-existent');

      // Assert
      expect(status).toBe('not_found');
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      // Arrange
      specificationQueue.getWaitingCount.mockResolvedValue(5);
      specificationQueue.getActiveCount.mockResolvedValue(2);
      specificationQueue.getCompletedCount.mockResolvedValue(100);
      specificationQueue.getFailedCount.mockResolvedValue(3);
      specificationQueue.getDelayedCount.mockResolvedValue(1);
      specificationQueue.getPausedCount.mockResolvedValue(0);

      // Act
      const stats = await service.getQueueStats(QueueName.SPECIFICATION);

      // Assert
      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        paused: 0,
        total: 111,
      });
    });

    it('should handle empty queue stats', async () => {
      // Arrange
      notificationQueue.getWaitingCount.mockResolvedValue(0);
      notificationQueue.getActiveCount.mockResolvedValue(0);
      notificationQueue.getCompletedCount.mockResolvedValue(0);
      notificationQueue.getFailedCount.mockResolvedValue(0);
      notificationQueue.getDelayedCount.mockResolvedValue(0);
      notificationQueue.getPausedCount.mockResolvedValue(0);

      // Act
      const stats = await service.getQueueStats(QueueName.NOTIFICATION);

      // Assert
      expect(stats.total).toBe(0);
    });
  });

  describe('cleanQueue', () => {
    it('should clean old completed and failed jobs', async () => {
      // Arrange
      const grace = 7200000; // 2 hours
      specificationQueue.clean.mockResolvedValue([]);

      // Act
      await service.cleanQueue(QueueName.SPECIFICATION, grace);

      // Assert
      expect(specificationQueue.clean).toHaveBeenCalledWith(grace, 'completed');
      expect(specificationQueue.clean).toHaveBeenCalledWith(grace, 'failed');
      expect(specificationQueue.clean).toHaveBeenCalledTimes(2);
    });

    it('should use default grace period', async () => {
      // Arrange
      specificationQueue.clean.mockResolvedValue([]);

      // Act
      await service.cleanQueue(QueueName.SPECIFICATION);

      // Assert
      expect(specificationQueue.clean).toHaveBeenCalledWith(3600000, 'completed');
      expect(specificationQueue.clean).toHaveBeenCalledWith(3600000, 'failed');
    });
  });

  describe('pauseQueue', () => {
    it('should pause the specified queue', async () => {
      // Arrange
      specificationQueue.pause.mockResolvedValue(undefined);

      // Act
      await service.pauseQueue(QueueName.SPECIFICATION);

      // Assert
      expect(specificationQueue.pause).toHaveBeenCalled();
    });

    it('should handle pause errors', async () => {
      // Arrange
      notificationQueue.pause.mockRejectedValue(new Error('Cannot pause'));

      // Act & Assert
      await expect(service.pauseQueue(QueueName.NOTIFICATION)).rejects.toThrow('Cannot pause');
    });
  });

  describe('resumeQueue', () => {
    it('should resume the specified queue', async () => {
      // Arrange
      specificationQueue.resume.mockResolvedValue(undefined);

      // Act
      await service.resumeQueue(QueueName.SPECIFICATION);

      // Assert
      expect(specificationQueue.resume).toHaveBeenCalled();
    });

    it('should handle resume errors', async () => {
      // Arrange
      analyticsQueue.resume.mockRejectedValue(new Error('Cannot resume'));

      // Act & Assert
      await expect(service.resumeQueue(QueueName.ANALYTICS)).rejects.toThrow('Cannot resume');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent job additions', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.TRACK_EVENT,
        payload: { event: 'test' },
      };
      analyticsQueue.add.mockResolvedValue(mockJob);

      // Act
      const promises = Array(10)
        .fill(null)
        .map(() => service.addJob(QueueName.ANALYTICS, jobData));
      const results = await Promise.all(promises);

      // Assert
      expect(analyticsQueue.add).toHaveBeenCalledTimes(10);
      expect(results).toHaveLength(10);
    });

    it('should handle queue errors gracefully', async () => {
      // Arrange
      const jobData: JobData = {
        type: JobType.SEND_EMAIL,
        payload: {},
      };
      notificationQueue.add.mockRejectedValue(new Error('Redis connection lost'));

      // Act & Assert
      await expect(service.addJob(QueueName.NOTIFICATION, jobData)).rejects.toThrow(
        'Redis connection lost',
      );
    });

    it('should handle invalid job data', async () => {
      // Arrange
      const invalidJobData = {
        // Missing required fields
        payload: {},
      } as JobData;

      specificationQueue.add.mockRejectedValue(new Error('Invalid job data'));

      // Act & Assert
      await expect(service.addJob(QueueName.SPECIFICATION, invalidJobData)).rejects.toThrow(
        'Invalid job data',
      );
    });
  });
});

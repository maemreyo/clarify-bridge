// UPDATED: 2025-06-17 - Added comprehensive specification processor tests

import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { SpecificationProcessor } from './specification.processor';
import { PrismaService } from '@core/database';
import { LlmCoreService } from '@core/llm';
import { JobData, JobResult, JobType } from '../job-queue.service';
import { SpecificationStatus } from '@prisma/client';

// Mock Bull job
const createMockJob = (id: string, data: JobData): Partial<Job<JobData>> => ({
  id,
  data,
  progress: jest.fn().mockResolvedValue(undefined),
  log: jest.fn(),
  finished: jest.fn(),
  failed: jest.fn(),
});

describe('SpecificationProcessor', () => {
  let processor: SpecificationProcessor;
  let prismaService: jest.Mocked<PrismaService>;
  let llmService: jest.Mocked<LlmCoreService>;
  let mockSpecificationService: jest.Mocked<any>;
  let mockNotificationService: jest.Mocked<any>;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-456';
  const mockSpecificationId = 'spec-789';

  beforeEach(async () => {
    // Create mock services
    mockSpecificationService = {
      generateSpecification: jest.fn(),
      updateSpecification: jest.fn(),
      performQualityCheck: jest.fn(),
    };

    mockNotificationService = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecificationProcessor,
        {
          provide: PrismaService,
          useValue: {
            specification: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
            },
            qualityMetrics: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: LlmCoreService,
          useValue: {
            generateText: jest.fn(),
            generateChat: jest.fn(),
          },
        },
        {
          provide: 'SpecificationService',
          useValue: mockSpecificationService,
        },
        {
          provide: 'NotificationService',
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    processor = module.get<SpecificationProcessor>(SpecificationProcessor);
    prismaService = module.get(PrismaService);
    llmService = module.get(LlmCoreService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('handleGenerateSpecification', () => {
    const mockJobData: JobData = {
      type: JobType.GENERATE_SPECIFICATION,
      payload: {
        title: 'Test Specification',
        description: 'A test specification for unit testing',
        context: { requirements: ['Feature 1', 'Feature 2'] },
        requirements: { priority: 'high' },
      },
      userId: mockUserId,
      teamId: mockTeamId,
    };

    it('should successfully process specification generation job', async () => {
      // Arrange
      const mockJob = createMockJob('job-1', mockJobData) as Job<JobData>;
      const mockSpecification = {
        id: mockSpecificationId,
        title: mockJobData.payload.title,
        description: mockJobData.payload.description,
        status: SpecificationStatus.DRAFT,
        authorId: mockUserId,
        teamId: mockTeamId,
      };
      const mockGenerationResult = { qualityScore: 0.85 };

      prismaService.specification.create.mockResolvedValue(mockSpecification as any);
      mockSpecificationService.generateSpecification.mockResolvedValue(mockGenerationResult);
      prismaService.specification.update.mockResolvedValue({ ...mockSpecification, status: SpecificationStatus.IN_REVIEW } as any);

      // Act
      const result = await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(20);
      expect(mockJob.progress).toHaveBeenCalledWith(80);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);

      expect(prismaService.specification.create).toHaveBeenCalledWith({
        data: {
          title: mockJobData.payload.title,
          description: mockJobData.payload.description,
          status: SpecificationStatus.DRAFT,
          authorId: mockUserId,
          teamId: mockTeamId,
        },
      });

      expect(mockSpecificationService.generateSpecification).toHaveBeenCalledWith({
        specificationId: mockSpecificationId,
        context: mockJobData.payload.context,
        requirements: mockJobData.payload.requirements,
      });

      expect(prismaService.specification.update).toHaveBeenCalledWith({
        where: { id: mockSpecificationId },
        data: {
          status: SpecificationStatus.IN_REVIEW,
          qualityScore: 0.85,
        },
      });

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        mockUserId,
        'SPEC_COMPLETED',
        {
          specificationId: mockSpecificationId,
          title: mockJobData.payload.title,
        }
      );

      expect(result).toEqual({
        success: true,
        data: {
          specificationId: mockSpecificationId,
          qualityScore: 0.85,
        },
      });
    });

    it('should handle missing userId gracefully', async () => {
      // Arrange
      const jobDataWithoutUserId = { ...mockJobData, userId: undefined };
      const mockJob = createMockJob('job-2', jobDataWithoutUserId) as Job<JobData>;
      const mockSpecification = {
        id: mockSpecificationId,
        title: mockJobData.payload.title,
        description: mockJobData.payload.description,
        status: SpecificationStatus.DRAFT,
        authorId: undefined,
        teamId: mockTeamId,
      };

      prismaService.specification.create.mockResolvedValue(mockSpecification as any);
      mockSpecificationService.generateSpecification.mockResolvedValue({ qualityScore: 0.85 });

      // Act
      const result = await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(prismaService.specification.create).toHaveBeenCalledWith({
        data: {
          title: mockJobData.payload.title,
          description: mockJobData.payload.description,
          status: SpecificationStatus.DRAFT,
          authorId: undefined,
          teamId: mockTeamId,
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle specification creation failure', async () => {
      // Arrange
      const mockJob = createMockJob('job-3', mockJobData) as Job<JobData>;
      const error = new Error('Database connection failed');
      prismaService.specification.create.mockRejectedValue(error);

      // Act
      const result = await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Database connection failed',
      });

      expect(mockSpecificationService.generateSpecification).not.toHaveBeenCalled();
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle specification generation service failure', async () => {
      // Arrange
      const mockJob = createMockJob('job-4', mockJobData) as Job<JobData>;
      const mockSpecification = { id: mockSpecificationId };

      prismaService.specification.create.mockResolvedValue(mockSpecification as any);
      mockSpecificationService.generateSpecification.mockRejectedValue(new Error('AI service unavailable'));

      // Act
      const result = await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'AI service unavailable',
      });

      expect(prismaService.specification.update).not.toHaveBeenCalled();
      expect(mockNotificationService.sendNotification).not.toHaveBeenCalled();
    });

    it('should handle notification service failure gracefully', async () => {
      // Arrange
      const mockJob = createMockJob('job-5', mockJobData) as Job<JobData>;
      const mockSpecification = { id: mockSpecificationId };

      prismaService.specification.create.mockResolvedValue(mockSpecification as any);
      mockSpecificationService.generateSpecification.mockResolvedValue({ qualityScore: 0.85 });
      prismaService.specification.update.mockResolvedValue(mockSpecification as any);
      mockNotificationService.sendNotification.mockRejectedValue(new Error('Notification failed'));

      // Act
      const result = await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Notification failed',
      });
    });
  });

  describe('handleUpdateSpecification', () => {
    const mockUpdateJobData: JobData = {
      type: JobType.UPDATE_SPECIFICATION,
      payload: {
        specificationId: mockSpecificationId,
        updates: {
          title: 'Updated Title',
          description: 'Updated Description',
        },
      },
      userId: mockUserId,
    };

    it('should successfully process specification update job', async () => {
      // Arrange
      const mockJob = createMockJob('update-job-1', mockUpdateJobData) as Job<JobData>;
      const mockUpdateResult = {
        id: mockSpecificationId,
        title: 'Updated Title',
        description: 'Updated Description',
      };

      mockSpecificationService.updateSpecification.mockResolvedValue(mockUpdateResult);

      // Act
      const result = await processor.handleUpdateSpecification(mockJob);

      // Assert
      expect(mockSpecificationService.updateSpecification).toHaveBeenCalledWith(
        mockSpecificationId,
        mockUpdateJobData.payload.updates
      );

      expect(result).toEqual({
        success: true,
        data: mockUpdateResult,
      });
    });

    it('should handle update service failure', async () => {
      // Arrange
      const mockJob = createMockJob('update-job-2', mockUpdateJobData) as Job<JobData>;
      const error = new Error('Update operation failed');

      mockSpecificationService.updateSpecification.mockRejectedValue(error);

      // Act
      const result = await processor.handleUpdateSpecification(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Update operation failed',
      });
    });

    it('should handle missing payload gracefully', async () => {
      // Arrange
      const jobDataWithoutPayload = { ...mockUpdateJobData, payload: {} } as JobData;
      const mockJob = createMockJob('update-job-3', jobDataWithoutPayload) as Job<JobData>;

      mockSpecificationService.updateSpecification.mockResolvedValue({});

      // Act
      const result = await processor.handleUpdateSpecification(mockJob);

      // Assert
      expect(mockSpecificationService.updateSpecification).toHaveBeenCalledWith(
        undefined,
        undefined
      );
      expect(result.success).toBe(true);
    });
  });

  describe('handleQualityCheck', () => {
    const mockQualityJobData: JobData = {
      type: JobType.QUALITY_CHECK,
      payload: {
        specificationId: mockSpecificationId,
      },
      userId: mockUserId,
    };

    const mockQualityResult = {
      overallScore: 0.85,
      aiSelfScore: 0.9,
      consistencyScore: 0.8,
      completenessScore: 0.85,
      issues: ['Minor formatting issue'],
    };

    it('should successfully process quality check job', async () => {
      // Arrange
      const mockJob = createMockJob('quality-job-1', mockQualityJobData) as Job<JobData>;

      mockSpecificationService.performQualityCheck.mockResolvedValue(mockQualityResult);
      prismaService.specification.update.mockResolvedValue({} as any);
      prismaService.qualityMetrics.create.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleQualityCheck(mockJob);

      // Assert
      expect(mockSpecificationService.performQualityCheck).toHaveBeenCalledWith(
        mockSpecificationId
      );

      expect(prismaService.specification.update).toHaveBeenCalledWith({
        where: { id: mockSpecificationId },
        data: {
          qualityScore: 0.85,
          lastReviewedAt: expect.any(Date),
        },
      });

      expect(prismaService.qualityMetrics.create).toHaveBeenCalledWith({
        data: {
          specificationId: mockSpecificationId,
          overallScore: 0.85,
          aiSelfScore: 0.9,
          consistencyScore: 0.8,
          completenessScore: 0.85,
          issues: ['Minor formatting issue'],
          reviewedAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        success: true,
        data: {
          qualityScore: 0.85,
          issues: ['Minor formatting issue'],
        },
      });
    });

    it('should handle quality check service failure', async () => {
      // Arrange
      const mockJob = createMockJob('quality-job-2', mockQualityJobData) as Job<JobData>;
      const error = new Error('Quality check service failed');

      mockSpecificationService.performQualityCheck.mockRejectedValue(error);

      // Act
      const result = await processor.handleQualityCheck(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Quality check service failed',
      });

      expect(prismaService.specification.update).not.toHaveBeenCalled();
      expect(prismaService.qualityMetrics.create).not.toHaveBeenCalled();
    });

    it('should handle database update failure during quality check', async () => {
      // Arrange
      const mockJob = createMockJob('quality-job-3', mockQualityJobData) as Job<JobData>;

      mockSpecificationService.performQualityCheck.mockResolvedValue(mockQualityResult);
      prismaService.specification.update.mockRejectedValue(new Error('Database update failed'));

      // Act
      const result = await processor.handleQualityCheck(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Database update failed',
      });

      expect(prismaService.qualityMetrics.create).not.toHaveBeenCalled();
    });

    it('should handle quality metrics creation failure', async () => {
      // Arrange
      const mockJob = createMockJob('quality-job-4', mockQualityJobData) as Job<JobData>;

      mockSpecificationService.performQualityCheck.mockResolvedValue(mockQualityResult);
      prismaService.specification.update.mockResolvedValue({} as any);
      prismaService.qualityMetrics.create.mockRejectedValue(new Error('Metrics creation failed'));

      // Act
      const result = await processor.handleQualityCheck(mockJob);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Metrics creation failed',
      });
    });

    it('should handle empty quality result', async () => {
      // Arrange
      const mockJob = createMockJob('quality-job-5', mockQualityJobData) as Job<JobData>;
      const emptyQualityResult = {
        overallScore: 0,
        issues: [],
      };

      mockSpecificationService.performQualityCheck.mockResolvedValue(emptyQualityResult);
      prismaService.specification.update.mockResolvedValue({} as any);
      prismaService.qualityMetrics.create.mockResolvedValue({} as any);

      // Act
      const result = await processor.handleQualityCheck(mockJob);

      // Assert
      expect(result).toEqual({
        success: true,
        data: {
          qualityScore: 0,
          issues: [],
        },
      });
    });
  });

  describe('processor configuration', () => {
    it('should have correct processor name', () => {
      // The processor should be decorated with @Processor(QueueName.SPECIFICATION)
      expect(processor).toBeDefined();
      expect(processor.constructor.name).toBe('SpecificationProcessor');
    });

    it('should inject all required dependencies', () => {
      expect(processor).toBeDefined();
      expect((processor as any).prisma).toBeDefined();
      expect((processor as any).llmService).toBeDefined();
      expect((processor as any).specificationService).toBeDefined();
      expect((processor as any).notificationService).toBeDefined();
    });
  });

  describe('error handling and logging', () => {
    it('should log job start for each process method', async () => {
      // Arrange
      const mockJob = createMockJob('log-test', {
        type: JobType.GENERATE_SPECIFICATION,
        payload: { title: 'Test' },
        userId: mockUserId,
      }) as Job<JobData>;

      const loggerSpy = jest.spyOn((processor as any).logger, 'log').mockImplementation();

      prismaService.specification.create.mockResolvedValue({ id: 'test' } as any);
      mockSpecificationService.generateSpecification.mockResolvedValue({ qualityScore: 0.85 });
      prismaService.specification.update.mockResolvedValue({} as any);

      // Act
      await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Processing specification generation job log-test'
      );
    });

    it('should log errors appropriately', async () => {
      // Arrange
      const mockJob = createMockJob('error-test', {
        type: JobType.GENERATE_SPECIFICATION,
        payload: { title: 'Test' },
        userId: mockUserId,
      }) as Job<JobData>;

      const error = new Error('Test error');
      const loggerSpy = jest.spyOn((processor as any).logger, 'error').mockImplementation();

      prismaService.specification.create.mockRejectedValue(error);

      // Act
      await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to process specification generation job error-test',
        error
      );
    });
  });

  describe('progress tracking', () => {
    it('should track progress throughout specification generation', async () => {
      // Arrange
      const mockJob = createMockJob('progress-test', {
        type: JobType.GENERATE_SPECIFICATION,
        payload: { title: 'Test', description: 'Test' },
        userId: mockUserId,
        teamId: mockTeamId,
      }) as Job<JobData>;

      prismaService.specification.create.mockResolvedValue({ id: 'test' } as any);
      mockSpecificationService.generateSpecification.mockResolvedValue({ qualityScore: 0.85 });
      prismaService.specification.update.mockResolvedValue({} as any);

      // Act
      await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledTimes(5);
      expect(mockJob.progress).toHaveBeenNthCalledWith(1, 10);
      expect(mockJob.progress).toHaveBeenNthCalledWith(2, 20);
      expect(mockJob.progress).toHaveBeenNthCalledWith(3, 80);
      expect(mockJob.progress).toHaveBeenNthCalledWith(4, 90);
      expect(mockJob.progress).toHaveBeenNthCalledWith(5, 100);
    });

    it('should not track progress on error', async () => {
      // Arrange
      const mockJob = createMockJob('progress-error-test', {
        type: JobType.GENERATE_SPECIFICATION,
        payload: { title: 'Test' },
        userId: mockUserId,
      }) as Job<JobData>;

      prismaService.specification.create.mockRejectedValue(new Error('Early failure'));

      // Act
      await processor.handleGenerateSpecification(mockJob);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledTimes(1); // Only initial progress
    });
  });
});
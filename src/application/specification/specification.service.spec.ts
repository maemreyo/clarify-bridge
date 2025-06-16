import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SpecificationService } from './specification.service';
import { PrismaService } from '@core/database';
import { JobQueueService, QueueName, JobType } from '@core/queue';
import { NotificationService } from '@core/notification';
import { VectorDbService } from '@core/vector-db';
import { UsageService } from '@core/usage';
import { MonitoringService } from '@core/monitoring';
import { SpecificationStatus, Priority, NotificationType, FeatureQuota } from '@prisma/client';
import {
  CreateSpecificationDto,
  UpdateSpecificationDto,
  UpdateSpecificationVersionDto,
  RegenerateViewDto,
  SpecificationFilterDto,
} from './dto/specification.dto';

describe('SpecificationService', () => {
  let service: SpecificationService;
  let prismaService: jest.Mocked<PrismaService>;
  let jobQueueService: jest.Mocked<JobQueueService>;
  let notificationService: jest.Mocked<NotificationService>;
  let vectorDbService: jest.Mocked<VectorDbService>;
  let usageService: jest.Mocked<UsageService>;
  let monitoringService: jest.Mocked<MonitoringService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscriptionTier: 'PREMIUM',
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Test Team',
    slug: 'test-team',
  };

  const mockSpecification = {
    id: 'spec-123',
    title: 'Test Specification',
    description: 'Test description',
    status: SpecificationStatus.DRAFT,
    priority: Priority.MEDIUM,
    authorId: 'user-123',
    teamId: 'team-123',
    qualityScore: 0.85,
    lastReviewedAt: null,
    externalLinks: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockUser,
    team: mockTeam,
    _count: {
      versions: 1,
      comments: 5,
    },
  };

  const mockVersion = {
    id: 'version-123',
    specificationId: 'spec-123',
    version: 1,
    pmView: { content: 'PM view content' },
    frontendView: { content: 'Frontend view content' },
    backendView: { content: 'Backend view content' },
    diagramSyntax: null,
    aiConfidenceScore: 0.9,
    validationResults: { valid: true },
    changesSummary: 'Initial version',
    createdAt: new Date(),
    createdBy: 'user-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecificationService,
        {
          provide: PrismaService,
          useValue: {
            specification: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            specificationVersion: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JobQueueService,
          useValue: {
            addJob: jest.fn(),
            getJobStatus: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: VectorDbService,
          useValue: {
            storeContext: jest.fn(),
            searchSimilar: jest.fn(),
          },
        },
        {
          provide: UsageService,
          useValue: {
            checkQuota: jest.fn(),
            trackUsage: jest.fn(),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            trackUserActivity: jest.fn(),
            trackMetric: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SpecificationService>(SpecificationService);
    prismaService = module.get(PrismaService);
    jobQueueService = module.get(JobQueueService);
    notificationService = module.get(NotificationService);
    vectorDbService = module.get(VectorDbService);
    usageService = module.get(UsageService);
    monitoringService = module.get(MonitoringService);

    jest.clearAllMocks();
  });

  describe('createSpecification', () => {
    const createDto: CreateSpecificationDto = {
      title: 'New Specification',
      description: 'New description',
      teamId: 'team-123',
      priority: Priority.HIGH,
      context: {
        requirements: 'User requirements',
        attachments: ['attachment1.pdf'],
        references: ['https://example.com'],
      },
    };

    it('should create specification successfully', async () => {
      // Arrange
      prismaService.specification.create.mockResolvedValue(mockSpecification);
      jobQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);
      vectorDbService.storeContext.mockResolvedValue('vector-123');

      // Act
      const result = await service.createSpecification('user-123', createDto);

      // Assert
      expect(monitoringService.trackUserActivity).toHaveBeenCalledWith(
        'user-123',
        'specification.create',
        {
          title: createDto.title,
          teamId: createDto.teamId,
        },
      );
      expect(prismaService.specification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: createDto.title,
          description: createDto.description,
          priority: createDto.priority,
          status: SpecificationStatus.DRAFT,
          authorId: 'user-123',
          teamId: createDto.teamId,
        }),
      });
      expect(vectorDbService.storeContext).toHaveBeenCalled();
      expect(jobQueueService.addJob).toHaveBeenCalledWith(
        QueueName.SPECIFICATION,
        expect.objectContaining({
          type: JobType.GENERATE_SPECIFICATION,
          payload: expect.objectContaining({
            specificationId: mockSpecification.id,
          }),
        }),
        expect.any(Object),
      );
      expect(result).toEqual({
        specification: mockSpecification,
        jobId: 'job-123',
      });
    });

    it('should handle creation without context', async () => {
      // Arrange
      const dtoWithoutContext = { ...createDto, context: undefined };
      prismaService.specification.create.mockResolvedValue(mockSpecification);
      jobQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      // Act
      const result = await service.createSpecification('user-123', dtoWithoutContext);

      // Assert
      expect(vectorDbService.storeContext).not.toHaveBeenCalled();
      expect(result.specification).toEqual(mockSpecification);
    });

    it('should handle database errors', async () => {
      // Arrange
      prismaService.specification.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createSpecification('user-123', createDto)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('getUserSpecifications', () => {
    it('should retrieve user specifications with pagination', async () => {
      // Arrange
      const filter: SpecificationFilterDto = {
        status: SpecificationStatus.DRAFT,
        teamId: 'team-123',
        limit: 10,
        offset: 0,
      };
      const specifications = [mockSpecification];
      prismaService.specification.findMany.mockResolvedValue(specifications);
      prismaService.specification.count.mockResolvedValue(1);

      // Act
      const result = await service.getUserSpecifications('user-123', filter);

      // Assert
      expect(prismaService.specification.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ authorId: 'user-123' }, { team: { members: { some: { userId: 'user-123' } } } }],
          status: filter.status,
          teamId: filter.teamId,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual({
        items: specifications,
        total: 1,
        limit: 10,
        offset: 0,
      });
    });

    it('should filter by search query', async () => {
      // Arrange
      const filter: SpecificationFilterDto = {
        search: 'test query',
      };
      prismaService.specification.findMany.mockResolvedValue([]);
      prismaService.specification.count.mockResolvedValue(0);

      // Act
      await service.getUserSpecifications('user-123', filter);

      // Assert
      expect(prismaService.specification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              title: { contains: 'test query', mode: 'insensitive' },
            }),
          ]),
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });
  });

  describe('getSpecification', () => {
    it('should retrieve specification with latest version', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue({
        ...mockSpecification,
        versions: [mockVersion],
      });

      // Act
      const result = await service.getSpecification('spec-123', 'user-123');

      // Assert
      expect(prismaService.specification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'spec-123',
          OR: [{ authorId: 'user-123' }, { team: { members: { some: { userId: 'user-123' } } } }],
        },
        include: expect.objectContaining({
          versions: expect.any(Object),
        }),
      });
      expect(result.latestVersion).toBeDefined();
      expect(result.latestVersion?.id).toBe(mockVersion.id);
    });

    it('should throw NotFoundException if specification not found', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getSpecification('non-existent', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSpecification', () => {
    const updateDto: UpdateSpecificationDto = {
      title: 'Updated Title',
      description: 'Updated description',
      priority: Priority.LOW,
    };

    it('should update specification successfully', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      prismaService.specification.update.mockResolvedValue({
        ...mockSpecification,
        ...updateDto,
      });

      // Act
      const result = await service.updateSpecification('spec-123', 'user-123', updateDto);

      // Assert
      expect(prismaService.specification.update).toHaveBeenCalledWith({
        where: { id: 'spec-123' },
        data: updateDto,
        include: expect.any(Object),
      });
      expect(result.title).toBe(updateDto.title);
    });

    it('should not allow updating specification in APPROVED status', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue({
        ...mockSpecification,
        status: SpecificationStatus.APPROVED,
      });

      // Act & Assert
      await expect(service.updateSpecification('spec-123', 'user-123', updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle access denied', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateSpecification('spec-123', 'user-123', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteSpecification', () => {
    it('should soft delete specification', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      prismaService.specification.update.mockResolvedValue({
        ...mockSpecification,
        status: SpecificationStatus.ARCHIVED,
      });

      // Act
      await service.deleteSpecification('spec-123', 'user-123');

      // Assert
      expect(prismaService.specification.update).toHaveBeenCalledWith({
        where: { id: 'spec-123' },
        data: { status: SpecificationStatus.ARCHIVED },
      });
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        'user-123',
        NotificationType.SPECIFICATION_ARCHIVED,
        expect.any(Object),
      );
    });

    it('should not allow deleting APPROVED specifications', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue({
        ...mockSpecification,
        status: SpecificationStatus.APPROVED,
      });

      // Act & Assert
      await expect(service.deleteSpecification('spec-123', 'user-123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should only allow author to delete', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue({
        ...mockSpecification,
        authorId: 'other-user',
      });

      // Act & Assert
      await expect(service.deleteSpecification('spec-123', 'user-123')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('regenerateViews', () => {
    it('should queue regeneration job for specific view', async () => {
      // Arrange
      const regenerateDto: RegenerateViewDto = {
        views: ['pmView', 'frontendView'],
        reason: 'Updating requirements',
      };
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      usageService.checkQuota.mockResolvedValue(true);
      jobQueueService.addJob.mockResolvedValue({ id: 'job-456' } as any);

      // Act
      const result = await service.regenerateViews('spec-123', 'user-123', regenerateDto);

      // Assert
      expect(usageService.checkQuota).toHaveBeenCalledWith(
        'user-123',
        'team-123',
        FeatureQuota.view_generated,
        2, // Two views
      );
      expect(jobQueueService.addJob).toHaveBeenCalledWith(
        QueueName.SPECIFICATION,
        expect.objectContaining({
          type: JobType.UPDATE_SPECIFICATION,
          payload: expect.objectContaining({
            views: regenerateDto.views,
            reason: regenerateDto.reason,
          }),
        }),
        expect.any(Object),
      );
      expect(result.jobId).toBe('job-456');
    });

    it('should throw error if quota exceeded', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      usageService.checkQuota.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.regenerateViews('spec-123', 'user-123', { views: ['pmView'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getGenerationStatus', () => {
    it('should return job status', async () => {
      // Arrange
      jobQueueService.getJobStatus.mockResolvedValue('completed');

      // Act
      const result = await service.getGenerationStatus('spec-123', 'job-123');

      // Assert
      expect(jobQueueService.getJobStatus).toHaveBeenCalledWith(QueueName.SPECIFICATION, 'job-123');
      expect(result).toEqual({
        specificationId: 'spec-123',
        jobId: 'job-123',
        status: 'completed',
      });
    });

    it('should handle unknown job status', async () => {
      // Arrange
      jobQueueService.getJobStatus.mockResolvedValue('not_found');

      // Act
      const result = await service.getGenerationStatus('spec-123', 'unknown-job');

      // Assert
      expect(result.status).toBe('not_found');
    });
  });

  describe('getRelatedSpecifications', () => {
    it('should find semantically similar specifications', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      vectorDbService.searchSimilar.mockResolvedValue(['spec-456', 'spec-789']);
      prismaService.specification.findMany.mockResolvedValue([
        { ...mockSpecification, id: 'spec-456', title: 'Related Spec 1' },
        { ...mockSpecification, id: 'spec-789', title: 'Related Spec 2' },
      ]);

      // Act
      const result = await service.getRelatedSpecifications('spec-123', 'user-123');

      // Assert
      expect(vectorDbService.searchSimilar).toHaveBeenCalledWith('spec-123', 5);
      expect(prismaService.specification.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['spec-456', 'spec-789'] },
          OR: [{ authorId: 'user-123' }, { team: { members: { some: { userId: 'user-123' } } } }],
        },
        include: expect.any(Object),
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no similar specifications found', async () => {
      // Arrange
      prismaService.specification.findFirst.mockResolvedValue(mockSpecification);
      vectorDbService.searchSimilar.mockResolvedValue([]);

      // Act
      const result = await service.getRelatedSpecifications('spec-123', 'user-123');

      // Assert
      expect(result).toEqual([]);
    });
  });
});

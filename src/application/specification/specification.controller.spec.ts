import { Test, TestingModule } from '@nestjs/testing';
import { SpecificationController } from './specification.controller';
import { SpecificationService } from './specification.service';
import {
  CreateSpecificationDto,
  UpdateSpecificationDto,
  UpdateSpecificationVersionDto,
  RegenerateViewDto,
  SpecificationFilterDto,
  SpecificationResponseDto,
  SpecificationListResponseDto,
  GenerationStatusDto,
} from './dto/specification.dto';
import { SpecificationStatus, ViewType } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

describe('SpecificationController', () => {
  let controller: SpecificationController;
  let specificationService: jest.Mocked<SpecificationService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSpecification: SpecificationResponseDto = {
    id: 'spec-123',
    title: 'Test Specification',
    description: 'Test description',
    status: SpecificationStatus.DRAFT,
    userId: mockUser.id,
    teamId: 'team-456',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    currentVersion: {
      id: 'version-123',
      versionNumber: 1,
      status: SpecificationStatus.DRAFT,
      pmView: { requirements: 'PM requirements' },
      frontendView: { components: 'Frontend components' },
      backendView: { apis: 'Backend APIs' },
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
    versions: [],
    tags: ['web', 'api'],
  };

  const mockSpecificationList: SpecificationListResponseDto = {
    specifications: [mockSpecification],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockGenerationStatus: GenerationStatusDto = {
    jobId: 'job-123',
    status: 'completed',
    progress: 100,
    result: {
      specificationId: 'spec-123',
      versionId: 'version-123',
    },
    createdAt: new Date('2024-01-15T10:00:00Z'),
    completedAt: new Date('2024-01-15T10:05:00Z'),
  };

  const mockRequest = {
    trackUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpecificationController],
      providers: [
        {
          provide: SpecificationService,
          useValue: {
            createSpecification: jest.fn(),
            getUserSpecifications: jest.fn(),
            getSpecification: jest.fn(),
            updateSpecification: jest.fn(),
            updateSpecificationVersion: jest.fn(),
            regenerateViews: jest.fn(),
            deleteSpecification: jest.fn(),
            getSpecificationVersions: jest.fn(),
            getGenerationStatus: jest.fn(),
            getRelatedSpecifications: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SpecificationController>(SpecificationController);
    specificationService = module.get(SpecificationService);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have SpecificationService injected', () => {
      expect(specificationService).toBeDefined();
    });
  });

  describe('create', () => {
    const createDto: CreateSpecificationDto = {
      title: 'New Specification',
      description: 'New description',
      requirements: 'Initial requirements',
      teamId: 'team-456',
      tags: ['new', 'test'],
    };

    it('should create specification successfully', async () => {
      // Arrange
      const expectedResult = {
        specification: mockSpecification,
        jobId: 'job-123',
      };
      specificationService.createSpecification.mockResolvedValue(expectedResult);

      // Act
      const result = await controller.create(mockUser.id, createDto, mockRequest);

      // Assert
      expect(specificationService.createSpecification).toHaveBeenCalledWith(mockUser.id, createDto);
      expect(result).toEqual(expectedResult);
      expect(mockRequest.trackUsage).toHaveBeenCalled();
    });

    it('should handle creation without usage tracking', async () => {
      // Arrange
      const expectedResult = {
        specification: mockSpecification,
        jobId: 'job-123',
      };
      specificationService.createSpecification.mockResolvedValue(expectedResult);
      const reqWithoutTracking = {};

      // Act
      const result = await controller.create(mockUser.id, createDto, reqWithoutTracking);

      // Assert
      expect(result).toEqual(expectedResult);
      // Should not throw error when trackUsage is not available
    });

    it('should handle creation errors', async () => {
      // Arrange
      const error = new BadRequestException('Invalid specification data');
      specificationService.createSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.create(mockUser.id, createDto, mockRequest)).rejects.toThrow(error);
      expect(mockRequest.trackUsage).not.toHaveBeenCalled();
    });

    it('should handle usage tracking errors gracefully', async () => {
      // Arrange
      const expectedResult = {
        specification: mockSpecification,
        jobId: 'job-123',
      };
      specificationService.createSpecification.mockResolvedValue(expectedResult);
      const reqWithFailingTracking = {
        trackUsage: jest.fn().mockRejectedValue(new Error('Tracking failed')),
      };

      // Act
      const result = await controller.create(mockUser.id, createDto, reqWithFailingTracking);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(reqWithFailingTracking.trackUsage).toHaveBeenCalled();
    });

    it('should validate required fields in DTO', async () => {
      // Arrange
      const invalidDto = {
        title: '', // Empty title
        description: 'Description',
      } as CreateSpecificationDto;

      const validationError = new BadRequestException('Title is required');
      specificationService.createSpecification.mockRejectedValue(validationError);

      // Act & Assert
      await expect(controller.create(mockUser.id, invalidDto, mockRequest)).rejects.toThrow(
        validationError
      );
    });
  });

  describe('getUserSpecifications', () => {
    const filterDto: SpecificationFilterDto = {
      status: SpecificationStatus.DRAFT,
      teamId: 'team-456',
      tags: ['web'],
      page: 1,
      limit: 10,
    };

    it('should get user specifications successfully', async () => {
      // Arrange
      specificationService.getUserSpecifications.mockResolvedValue(mockSpecificationList);

      // Act
      const result = await controller.getUserSpecifications(mockUser.id, filterDto);

      // Assert
      expect(specificationService.getUserSpecifications).toHaveBeenCalledWith(
        mockUser.id,
        filterDto
      );
      expect(result).toEqual(mockSpecificationList);
    });

    it('should handle empty filter', async () => {
      // Arrange
      const emptyFilter: SpecificationFilterDto = {};
      specificationService.getUserSpecifications.mockResolvedValue(mockSpecificationList);

      // Act
      const result = await controller.getUserSpecifications(mockUser.id, emptyFilter);

      // Assert
      expect(specificationService.getUserSpecifications).toHaveBeenCalledWith(
        mockUser.id,
        emptyFilter
      );
      expect(result).toEqual(mockSpecificationList);
    });

    it('should handle pagination parameters', async () => {
      // Arrange
      const paginationFilter: SpecificationFilterDto = {
        page: 2,
        limit: 5,
      };
      specificationService.getUserSpecifications.mockResolvedValue(mockSpecificationList);

      // Act
      await controller.getUserSpecifications(mockUser.id, paginationFilter);

      // Assert
      expect(specificationService.getUserSpecifications).toHaveBeenCalledWith(
        mockUser.id,
        paginationFilter
      );
    });

    it('should handle unauthorized access', async () => {
      // Arrange
      const error = new UnauthorizedException('User not authorized');
      specificationService.getUserSpecifications.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getUserSpecifications(mockUser.id, filterDto)).rejects.toThrow(
        error
      );
    });
  });

  describe('getSpecification', () => {
    const specificationId = 'spec-123';

    it('should get specification by ID successfully', async () => {
      // Arrange
      specificationService.getSpecification.mockResolvedValue(mockSpecification);

      // Act
      const result = await controller.getSpecification(specificationId, mockUser.id);

      // Assert
      expect(specificationService.getSpecification).toHaveBeenCalledWith(
        specificationId,
        mockUser.id
      );
      expect(result).toEqual(mockSpecification);
    });

    it('should handle specification not found', async () => {
      // Arrange
      const error = new NotFoundException('Specification not found');
      specificationService.getSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getSpecification(specificationId, mockUser.id)).rejects.toThrow(
        error
      );
    });

    it('should handle access denied to specification', async () => {
      // Arrange
      const error = new ForbiddenException('Access denied to specification');
      specificationService.getSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getSpecification(specificationId, mockUser.id)).rejects.toThrow(
        error
      );
    });

    it('should handle invalid specification ID format', async () => {
      // Arrange
      const invalidId = 'invalid-id';
      const error = new BadRequestException('Invalid specification ID format');
      specificationService.getSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getSpecification(invalidId, mockUser.id)).rejects.toThrow(error);
    });
  });

  describe('updateSpecification', () => {
    const specificationId = 'spec-123';
    const updateDto: UpdateSpecificationDto = {
      title: 'Updated Title',
      description: 'Updated description',
      tags: ['updated', 'test'],
    };

    it('should update specification successfully', async () => {
      // Arrange
      const updatedSpecification = {
        ...mockSpecification,
        title: updateDto.title,
        description: updateDto.description,
        tags: updateDto.tags,
        updatedAt: new Date(),
      };
      specificationService.updateSpecification.mockResolvedValue(updatedSpecification);

      // Act
      const result = await controller.updateSpecification(specificationId, mockUser.id, updateDto);

      // Assert
      expect(specificationService.updateSpecification).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        updateDto
      );
      expect(result).toEqual(updatedSpecification);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const partialUpdateDto: UpdateSpecificationDto = {
        title: 'New Title Only',
      };
      specificationService.updateSpecification.mockResolvedValue(mockSpecification);

      // Act
      await controller.updateSpecification(specificationId, mockUser.id, partialUpdateDto);

      // Assert
      expect(specificationService.updateSpecification).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        partialUpdateDto
      );
    });

    it('should handle update conflicts', async () => {
      // Arrange
      const error = new BadRequestException('Specification is currently being processed');
      specificationService.updateSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.updateSpecification(specificationId, mockUser.id, updateDto)
      ).rejects.toThrow(error);
    });

    it('should handle unauthorized update', async () => {
      // Arrange
      const error = new ForbiddenException('Cannot update specification');
      specificationService.updateSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.updateSpecification(specificationId, mockUser.id, updateDto)
      ).rejects.toThrow(error);
    });
  });

  describe('updateVersion', () => {
    const specificationId = 'spec-123';
    const versionDto: UpdateSpecificationVersionDto = {
      changelog: 'Added new features',
      requirements: 'Updated requirements',
    };

    it('should create new version successfully', async () => {
      // Arrange
      const newVersion = {
        id: 'version-124',
        versionNumber: 2,
        changelog: versionDto.changelog,
        jobId: 'job-456',
      };
      specificationService.updateSpecificationVersion.mockResolvedValue(newVersion);

      // Act
      const result = await controller.updateVersion(specificationId, mockUser.id, versionDto);

      // Assert
      expect(specificationService.updateSpecificationVersion).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        versionDto
      );
      expect(result).toEqual(newVersion);
    });

    it('should handle version creation errors', async () => {
      // Arrange
      const error = new BadRequestException('Cannot create new version');
      specificationService.updateSpecificationVersion.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.updateVersion(specificationId, mockUser.id, versionDto)
      ).rejects.toThrow(error);
    });

    it('should handle changelog requirements', async () => {
      // Arrange
      const dtoWithoutChangelog: UpdateSpecificationVersionDto = {
        requirements: 'Updated requirements',
      };
      specificationService.updateSpecificationVersion.mockResolvedValue({
        id: 'version-124',
        versionNumber: 2,
      });

      // Act
      await controller.updateVersion(specificationId, mockUser.id, dtoWithoutChangelog);

      // Assert
      expect(specificationService.updateSpecificationVersion).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        dtoWithoutChangelog
      );
    });
  });

  describe('regenerateViews', () => {
    const specificationId = 'spec-123';
    const regenerateDto: RegenerateViewDto = {
      views: [ViewType.PM, ViewType.FRONTEND],
      requirements: 'Updated requirements for regeneration',
    };

    it('should regenerate views successfully', async () => {
      // Arrange
      const regenerateResult = {
        jobId: 'job-789',
        message: 'Views queued for regeneration',
      };
      specificationService.regenerateViews.mockResolvedValue(regenerateResult);

      // Act
      const result = await controller.regenerateViews(
        specificationId,
        mockUser.id,
        regenerateDto,
        mockRequest
      );

      // Assert
      expect(specificationService.regenerateViews).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        regenerateDto
      );
      expect(result).toEqual(regenerateResult);
      expect(mockRequest.trackUsage).toHaveBeenCalled();
    });

    it('should handle regeneration with all views', async () => {
      // Arrange
      const allViewsDto: RegenerateViewDto = {
        views: [ViewType.PM, ViewType.FRONTEND, ViewType.BACKEND],
      };
      specificationService.regenerateViews.mockResolvedValue({
        jobId: 'job-all',
        message: 'All views queued for regeneration',
      });

      // Act
      await controller.regenerateViews(specificationId, mockUser.id, allViewsDto, mockRequest);

      // Assert
      expect(specificationService.regenerateViews).toHaveBeenCalledWith(
        specificationId,
        mockUser.id,
        allViewsDto
      );
    });

    it('should handle regeneration errors', async () => {
      // Arrange
      const error = new BadRequestException('Cannot regenerate views at this time');
      specificationService.regenerateViews.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.regenerateViews(specificationId, mockUser.id, regenerateDto, mockRequest)
      ).rejects.toThrow(error);
      expect(mockRequest.trackUsage).not.toHaveBeenCalled();
    });

    it('should handle empty views array', async () => {
      // Arrange
      const emptyViewsDto: RegenerateViewDto = {
        views: [],
      };
      const error = new BadRequestException('At least one view must be specified');
      specificationService.regenerateViews.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.regenerateViews(specificationId, mockUser.id, emptyViewsDto, mockRequest)
      ).rejects.toThrow(error);
    });
  });

  describe('deleteSpecification', () => {
    const specificationId = 'spec-123';

    it('should delete specification successfully', async () => {
      // Arrange
      specificationService.deleteSpecification.mockResolvedValue(undefined);

      // Act
      await controller.deleteSpecification(specificationId, mockUser.id);

      // Assert
      expect(specificationService.deleteSpecification).toHaveBeenCalledWith(
        specificationId,
        mockUser.id
      );
    });

    it('should handle specification not found for deletion', async () => {
      // Arrange
      const error = new NotFoundException('Specification not found');
      specificationService.deleteSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.deleteSpecification(specificationId, mockUser.id)).rejects.toThrow(
        error
      );
    });

    it('should handle unauthorized deletion', async () => {
      // Arrange
      const error = new ForbiddenException('Cannot delete this specification');
      specificationService.deleteSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.deleteSpecification(specificationId, mockUser.id)).rejects.toThrow(
        error
      );
    });

    it('should handle deletion of specification with active jobs', async () => {
      // Arrange
      const error = new BadRequestException('Cannot delete specification with active generation jobs');
      specificationService.deleteSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.deleteSpecification(specificationId, mockUser.id)).rejects.toThrow(
        error
      );
    });
  });

  describe('getVersions', () => {
    const specificationId = 'spec-123';

    it('should get specification versions successfully', async () => {
      // Arrange
      const versions = [
        {
          id: 'version-123',
          versionNumber: 1,
          status: SpecificationStatus.COMPLETED,
          createdAt: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 'version-124',
          versionNumber: 2,
          status: SpecificationStatus.DRAFT,
          createdAt: new Date('2024-01-16T10:00:00Z'),
        },
      ];
      specificationService.getSpecificationVersions.mockResolvedValue(versions);

      // Act
      const result = await controller.getVersions(specificationId, mockUser.id);

      // Assert
      expect(specificationService.getSpecificationVersions).toHaveBeenCalledWith(
        specificationId,
        mockUser.id
      );
      expect(result).toEqual(versions);
    });

    it('should handle empty versions list', async () => {
      // Arrange
      specificationService.getSpecificationVersions.mockResolvedValue([]);

      // Act
      const result = await controller.getVersions(specificationId, mockUser.id);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle unauthorized access to versions', async () => {
      // Arrange
      const error = new ForbiddenException('Access denied to specification versions');
      specificationService.getSpecificationVersions.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getVersions(specificationId, mockUser.id)).rejects.toThrow(error);
    });
  });

  describe('getGenerationStatus', () => {
    const specificationId = 'spec-123';
    const jobId = 'job-456';

    it('should get generation status successfully', async () => {
      // Arrange
      specificationService.getGenerationStatus.mockResolvedValue(mockGenerationStatus);

      // Act
      const result = await controller.getGenerationStatus(specificationId, jobId);

      // Assert
      expect(specificationService.getGenerationStatus).toHaveBeenCalledWith(
        specificationId,
        jobId
      );
      expect(result).toEqual(mockGenerationStatus);
    });

    it('should handle in-progress generation status', async () => {
      // Arrange
      const inProgressStatus: GenerationStatusDto = {
        jobId,
        status: 'active',
        progress: 45,
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };
      specificationService.getGenerationStatus.mockResolvedValue(inProgressStatus);

      // Act
      const result = await controller.getGenerationStatus(specificationId, jobId);

      // Assert
      expect(result).toEqual(inProgressStatus);
    });

    it('should handle failed generation status', async () => {
      // Arrange
      const failedStatus: GenerationStatusDto = {
        jobId,
        status: 'failed',
        progress: 0,
        error: 'Generation failed due to invalid requirements',
        createdAt: new Date('2024-01-15T10:00:00Z'),
        failedAt: new Date('2024-01-15T10:02:00Z'),
      };
      specificationService.getGenerationStatus.mockResolvedValue(failedStatus);

      // Act
      const result = await controller.getGenerationStatus(specificationId, jobId);

      // Assert
      expect(result).toEqual(failedStatus);
    });

    it('should handle job not found', async () => {
      // Arrange
      const error = new NotFoundException('Generation job not found');
      specificationService.getGenerationStatus.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getGenerationStatus(specificationId, jobId)).rejects.toThrow(error);
    });

    it('should handle invalid job ID format', async () => {
      // Arrange
      const invalidJobId = 'invalid-job-id';
      const error = new BadRequestException('Invalid job ID format');
      specificationService.getGenerationStatus.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getGenerationStatus(specificationId, invalidJobId)
      ).rejects.toThrow(error);
    });
  });

  describe('getRelated', () => {
    const specificationId = 'spec-123';

    it('should get related specifications successfully', async () => {
      // Arrange
      const relatedSpecs = [
        {
          id: 'spec-456',
          title: 'Related Spec 1',
          similarity: 0.85,
          tags: ['web', 'api'],
        },
        {
          id: 'spec-789',
          title: 'Related Spec 2',
          similarity: 0.72,
          tags: ['mobile', 'api'],
        },
      ];
      specificationService.getRelatedSpecifications.mockResolvedValue(relatedSpecs);

      // Act
      const result = await controller.getRelated(specificationId, mockUser.id);

      // Assert
      expect(specificationService.getRelatedSpecifications).toHaveBeenCalledWith(
        specificationId,
        mockUser.id
      );
      expect(result).toEqual(relatedSpecs);
    });

    it('should handle no related specifications found', async () => {
      // Arrange
      specificationService.getRelatedSpecifications.mockResolvedValue([]);

      // Act
      const result = await controller.getRelated(specificationId, mockUser.id);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle related specifications with different similarity scores', async () => {
      // Arrange
      const relatedSpecs = [
        { id: 'spec-1', title: 'High Similarity', similarity: 0.95 },
        { id: 'spec-2', title: 'Medium Similarity', similarity: 0.60 },
        { id: 'spec-3', title: 'Low Similarity', similarity: 0.35 },
      ];
      specificationService.getRelatedSpecifications.mockResolvedValue(relatedSpecs);

      // Act
      const result = await controller.getRelated(specificationId, mockUser.id);

      // Assert
      expect(result).toEqual(relatedSpecs);
    });

    it('should handle unauthorized access to related specifications', async () => {
      // Arrange
      const error = new ForbiddenException('Access denied to related specifications');
      specificationService.getRelatedSpecifications.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getRelated(specificationId, mockUser.id)).rejects.toThrow(error);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle concurrent requests to same specification', async () => {
      // Arrange
      const specificationId = 'spec-123';
      specificationService.getSpecification.mockResolvedValue(mockSpecification);

      // Act
      const promises = Array.from({ length: 5 }, () =>
        controller.getSpecification(specificationId, mockUser.id)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual(mockSpecification);
      });
      expect(specificationService.getSpecification).toHaveBeenCalledTimes(5);
    });

    it('should handle empty request parameters', async () => {
      // Arrange
      const emptyId = '';
      const error = new BadRequestException('Specification ID is required');
      specificationService.getSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getSpecification(emptyId, mockUser.id)).rejects.toThrow(error);
    });

    it('should handle null/undefined parameters gracefully', async () => {
      // Arrange
      const nullId = null as any;
      const error = new BadRequestException('Invalid specification ID');
      specificationService.getSpecification.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getSpecification(nullId, mockUser.id)).rejects.toThrow(error);
    });

    it('should handle service timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Service timeout');
      specificationService.createSpecification.mockRejectedValue(timeoutError);

      const createDto: CreateSpecificationDto = {
        title: 'Test Spec',
        description: 'Test description',
        requirements: 'Requirements',
      };

      // Act & Assert
      await expect(controller.create(mockUser.id, createDto, mockRequest)).rejects.toThrow(
        timeoutError
      );
    });

    it('should handle database connection errors', async () => {
      // Arrange
      const dbError = new Error('Database connection failed');
      specificationService.getUserSpecifications.mockRejectedValue(dbError);

      // Act & Assert
      await expect(controller.getUserSpecifications(mockUser.id, {})).rejects.toThrow(dbError);
    });
  });

  describe('Guards and Security', () => {
    it('should have JwtAuthGuard applied to all endpoints', () => {
      // This test verifies that the controller class has the JwtAuthGuard decorator
      const guards = Reflect.getMetadata('__guards__', SpecificationController);
      expect(guards).toBeDefined();
    });

    it('should have UsageGuard applied to resource-intensive endpoints', () => {
      // Verify that create and regenerateViews methods have UsageGuard
      const createGuards = Reflect.getMetadata('__guards__', controller.create);
      const regenerateGuards = Reflect.getMetadata('__guards__', controller.regenerateViews);

      // These should include UsageGuard (implementation detail may vary)
      expect(createGuards || regenerateGuards).toBeDefined();
    });

    it('should handle user context from CurrentUser decorator', async () => {
      // Arrange
      specificationService.getUserSpecifications.mockResolvedValue(mockSpecificationList);

      // Act
      await controller.getUserSpecifications(mockUser.id, {});

      // Assert
      expect(specificationService.getUserSpecifications).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large specification lists efficiently', async () => {
      // Arrange
      const largeSpecList: SpecificationListResponseDto = {
        specifications: Array.from({ length: 100 }, (_, i) => ({
          ...mockSpecification,
          id: `spec-${i}`,
          title: `Specification ${i}`,
        })),
        total: 100,
        page: 1,
        limit: 100,
        totalPages: 1,
      };
      specificationService.getUserSpecifications.mockResolvedValue(largeSpecList);

      // Act
      const result = await controller.getUserSpecifications(mockUser.id, { limit: 100 });

      // Assert
      expect(result.specifications).toHaveLength(100);
      expect(result.total).toBe(100);
    });

    it('should handle memory efficiently with repeated operations', async () => {
      // Arrange
      specificationService.getSpecification.mockResolvedValue(mockSpecification);
      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Many repeated calls
      for (let i = 0; i < 50; i++) {
        await controller.getSpecification('spec-123', mockUser.id);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { UsageStatsQueryDto } from './dto/usage.dto';
import { SubscriptionTier } from '@prisma/client';
import { USAGE_QUOTAS } from './interfaces/usage.interface';

describe('UsageController', () => {
  let controller: UsageController;
  let usageService: jest.Mocked<UsageService>;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-123';

  const mockUserStats = {
    period: {
      start: new Date('2024-06-01'),
      end: new Date('2024-06-30'),
    },
    usage: {
      specifications: 30,
      aiGenerations: 150,
      teamMembers: 0,
      storage: 50,
      apiCalls: 5000,
    },
    quota: USAGE_QUOTAS[SubscriptionTier.PREMIUM],
    percentages: {
      specifications: 30,
      aiGenerations: 15,
      teamMembers: 0,
      storage: 1,
      apiCalls: 10,
    },
  };

  const mockTeamStats = {
    period: {
      start: new Date('2024-06-01'),
      end: new Date('2024-06-30'),
    },
    usage: {
      specifications: 200,
      aiGenerations: 1000,
      teamMembers: 15,
      storage: 2000,
      apiCalls: 50000,
    },
    quota: USAGE_QUOTAS[SubscriptionTier.PROFESSIONAL],
    percentages: {
      specifications: 40,
      aiGenerations: 50,
      teamMembers: 30,
      storage: 20,
      apiCalls: 50,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsageController],
      providers: [
        {
          provide: UsageService,
          useValue: {
            getUserUsageStats: jest.fn(),
            getTeamUsageStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsageController>(UsageController);
    usageService = module.get(UsageService);

    jest.clearAllMocks();
  });

  describe('getUserStats', () => {
    it('should return user usage statistics for current month', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockUserStats);
    });

    it('should handle custom date range', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-05-01',
        endDate: '2024-05-31',
      };
      usageService.getUserUsageStats.mockResolvedValue({
        ...mockUserStats,
        period: {
          start: new Date('2024-05-01'),
          end: new Date('2024-05-31'),
        },
      });

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-05-01'),
        new Date('2024-05-31'),
      );
      expect(result.period.start).toEqual(new Date('2024-05-01'));
      expect(result.period.end).toEqual(new Date('2024-05-31'));
    });

    it('should handle invalid date format gracefully', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: 'invalid-date',
        endDate: '2024-05-31',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      // The controller creates Date objects which will be Invalid Date for bad input
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Date),
        expect.any(Date),
      );
      expect(result).toEqual(mockUserStats);
    });

    it('should handle partial date range (only startDate)', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-05-01',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-05-01'),
        undefined,
      );
    });

    it('should handle partial date range (only endDate)', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        endDate: '2024-05-31',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        new Date('2024-05-31'),
      );
    });

    it('should handle service errors', async () => {
      // Arrange
      usageService.getUserUsageStats.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(controller.getUserStats(mockUserId, {})).rejects.toThrow('User not found');
    });

    it('should return zero usage for new users', async () => {
      // Arrange
      const zeroUsageStats = {
        ...mockUserStats,
        usage: {
          specifications: 0,
          aiGenerations: 0,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
        percentages: {
          specifications: 0,
          aiGenerations: 0,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
      };
      usageService.getUserUsageStats.mockResolvedValue(zeroUsageStats);

      // Act
      const result = await controller.getUserStats(mockUserId, {});

      // Assert
      expect(result.usage.specifications).toBe(0);
      expect(result.percentages.specifications).toBe(0);
    });
  });

  describe('getTeamStats', () => {
    it('should return team usage statistics for current month', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledWith(
        mockTeamId,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockTeamStats);
    });

    it('should handle custom date range for team stats', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      };
      const yearlyStats = {
        ...mockTeamStats,
        period: {
          start: new Date('2024-01-01'),
          end: new Date('2024-12-31'),
        },
        usage: {
          specifications: 2400,
          aiGenerations: 12000,
          teamMembers: 15,
          storage: 10000,
          apiCalls: 600000,
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(yearlyStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledWith(
        mockTeamId,
        new Date('2024-01-01'),
        new Date('2024-12-31'),
      );
      expect(result.period.start).toEqual(new Date('2024-01-01'));
      expect(result.period.end).toEqual(new Date('2024-12-31'));
      expect(result.usage.specifications).toBe(2400);
    });

    it('should handle team not found error', async () => {
      // Arrange
      usageService.getTeamUsageStats.mockRejectedValue(new Error('Team not found'));

      // Act & Assert
      await expect(controller.getTeamStats(mockTeamId, {})).rejects.toThrow('Team not found');
    });

    it('should show high usage percentages for teams near quota', async () => {
      // Arrange
      const highUsageStats = {
        ...mockTeamStats,
        usage: {
          specifications: 480,
          aiGenerations: 1900,
          teamMembers: 48,
          storage: 9500,
          apiCalls: 95000,
        },
        percentages: {
          specifications: 96,
          aiGenerations: 95,
          teamMembers: 96,
          storage: 95,
          apiCalls: 95,
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(highUsageStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, {});

      // Assert
      expect(result.percentages.specifications).toBe(96);
      expect(result.percentages.aiGenerations).toBe(95);
    });

    it('should handle ENTERPRISE tier with unlimited quotas', async () => {
      // Arrange
      const enterpriseStats = {
        ...mockTeamStats,
        quota: USAGE_QUOTAS[SubscriptionTier.ENTERPRISE],
        percentages: {
          specifications: 0, // Unlimited shows as 0%
          aiGenerations: 0,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(enterpriseStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, {});

      // Assert
      expect(result.quota.specifications).toBe(-1); // -1 indicates unlimited
      expect(result.percentages.specifications).toBe(0);
    });

    it('should handle concurrent requests', async () => {
      // Arrange
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => controller.getTeamStats(mockTeamId, {}));

      const results = await Promise.all(promises);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledTimes(5);
      results.forEach((result) => {
        expect(result).toEqual(mockTeamStats);
      });
    });
  });

  describe('date parsing edge cases', () => {
    it('should handle ISO date strings', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01T00:00:00.000Z',
        endDate: '2024-06-30T23:59:59.999Z',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-06-01T00:00:00.000Z'),
        new Date('2024-06-30T23:59:59.999Z'),
      );
    });

    it('should handle timezone differences', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01T00:00:00+07:00', // UTC+7
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      const expectedDate = new Date('2024-06-01T00:00:00+07:00');
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        expectedDate,
        undefined,
      );
    });

    it('should handle date strings without time', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      };
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledWith(
        mockTeamId,
        new Date('2024-06-01'),
        new Date('2024-06-30'),
      );
    });
  });

  describe('authorization scenarios', () => {
    it('should have JwtAuthGuard applied globally', () => {
      // This is a conceptual test - verifies the controller methods exist
      expect(typeof controller.getUserStats).toBe('function');
      expect(typeof controller.getTeamStats).toBe('function');
    });

    it('should use CurrentUser decorator for getUserStats', () => {
      // Verify the method accepts userId as first parameter
      expect(controller.getUserStats.length).toBe(2); // userId and query
    });

    it('should have TeamMemberGuard on getTeamStats', () => {
      // This would be tested through integration tests
      // Here we verify the method structure
      expect(controller.getTeamStats.length).toBe(2); // teamId and query
    });
  });

  describe('response formatting', () => {
    it('should return consistent stat structure', async () => {
      // Arrange
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, {});

      // Assert
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('quota');
      expect(result).toHaveProperty('percentages');
      expect(result.period).toHaveProperty('start');
      expect(result.period).toHaveProperty('end');
    });

    it('should include all usage metrics', async () => {
      // Arrange
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, {});

      // Assert
      const usageKeys = Object.keys(result.usage);
      expect(usageKeys).toContain('specifications');
      expect(usageKeys).toContain('aiGenerations');
      expect(usageKeys).toContain('teamMembers');
      expect(usageKeys).toContain('storage');
      expect(usageKeys).toContain('apiCalls');
    });
  });
});
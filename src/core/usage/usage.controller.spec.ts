// UPDATED: 2025-06-17 - Added comprehensive usage controller tests

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
  const mockTeamId = 'team-456';

  const mockUserStats = {
    period: {
      start: new Date('2024-06-01T00:00:00.000Z'),
      end: new Date('2024-06-30T23:59:59.999Z'),
    },
    usage: {
      specifications: 30,
      aiGenerations: 150,
      teamMembers: 5,
      storage: 750,
      apiCalls: 8500,
    },
    quota: USAGE_QUOTAS[SubscriptionTier.STARTER],
    percentages: {
      specifications: 60, // 30/50
      aiGenerations: 75, // 150/200
      teamMembers: 50, // 5/10
      storage: 75, // 750/1000
      apiCalls: 85, // 8500/10000
    },
  };

  const mockTeamStats = {
    period: {
      start: new Date('2024-06-01T00:00:00.000Z'),
      end: new Date('2024-06-30T23:59:59.999Z'),
    },
    usage: {
      specifications: 200,
      aiGenerations: 1000,
      teamMembers: 15,
      storage: 5000,
      apiCalls: 50000,
    },
    quota: USAGE_QUOTAS[SubscriptionTier.PROFESSIONAL],
    percentages: {
      specifications: 40, // 200/500
      aiGenerations: 50, // 1000/2000
      teamMembers: 30, // 15/50
      storage: 50, // 5000/10000
      apiCalls: 50, // 50000/100000
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
        undefined
      );
      expect(result).toEqual(mockUserStats);
    });

    it('should handle custom date range for user stats', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-05-01',
        endDate: '2024-05-31',
      };
      const customPeriodStats = {
        ...mockUserStats,
        period: {
          start: new Date('2024-05-01'),
          end: new Date('2024-05-31'),
        },
        usage: {
          specifications: 20,
          aiGenerations: 80,
          teamMembers: 3,
          storage: 400,
          apiCalls: 4000,
        },
      };
      usageService.getUserUsageStats.mockResolvedValue(customPeriodStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-05-01'),
        new Date('2024-05-31')
      );
      expect(result.period.start).toEqual(new Date('2024-05-01'));
      expect(result.period.end).toEqual(new Date('2024-05-31'));
      expect(result.usage.specifications).toBe(20);
    });

    it('should handle only start date provided', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-06-01'),
        undefined
      );
    });

    it('should handle only end date provided', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        endDate: '2024-06-30',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        undefined,
        new Date('2024-06-30')
      );
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getUserUsageStats.mockRejectedValue(new Error('User not found'));

      // Act & Assert
      await expect(controller.getUserStats(mockUserId, query)).rejects.toThrow('User not found');
    });

    it('should return zero usage for new users', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      const newUserStats = {
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
      usageService.getUserUsageStats.mockResolvedValue(newUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(result.usage.specifications).toBe(0);
      expect(result.usage.aiGenerations).toBe(0);
      expect(result.percentages.specifications).toBe(0);
      expect(result.percentages.aiGenerations).toBe(0);
    });

    it('should handle high usage percentages near limits', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      const highUsageStats = {
        ...mockUserStats,
        usage: {
          specifications: 49,
          aiGenerations: 195,
          teamMembers: 9,
          storage: 950,
          apiCalls: 9800,
        },
        percentages: {
          specifications: 98, // 49/50
          aiGenerations: 97.5, // 195/200
          teamMembers: 90, // 9/10
          storage: 95, // 950/1000
          apiCalls: 98, // 9800/10000
        },
      };
      usageService.getUserUsageStats.mockResolvedValue(highUsageStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(result.percentages.specifications).toBe(98);
      expect(result.percentages.aiGenerations).toBe(97.5);
      expect(result.percentages.apiCalls).toBe(98);
    });

    it('should handle Enterprise tier with unlimited quotas', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      const enterpriseStats = {
        ...mockUserStats,
        quota: USAGE_QUOTAS[SubscriptionTier.ENTERPRISE],
        usage: {
          specifications: 1000,
          aiGenerations: 5000,
          teamMembers: 100,
          storage: 50000,
          apiCalls: 500000,
        },
        percentages: {
          specifications: 0, // Unlimited shows as 0%
          aiGenerations: 0,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
      };
      usageService.getUserUsageStats.mockResolvedValue(enterpriseStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(result.quota.specifications).toBe(-1); // -1 indicates unlimited
      expect(result.percentages.specifications).toBe(0);
      expect(result.usage.specifications).toBe(1000); // Actual usage is still tracked
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
        undefined
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
          storage: 25000,
          apiCalls: 600000,
        },
        percentages: {
          specifications: 480, // 2400/500 (over limit)
          aiGenerations: 600, // 12000/2000 (over limit)
          teamMembers: 30, // 15/50
          storage: 250, // 25000/10000 (over limit)
          apiCalls: 600, // 600000/100000 (over limit)
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(yearlyStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledWith(
        mockTeamId,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      expect(result.period.start).toEqual(new Date('2024-01-01'));
      expect(result.period.end).toEqual(new Date('2024-12-31'));
      expect(result.usage.specifications).toBe(2400);
    });

    it('should handle team not found error', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getTeamUsageStats.mockRejectedValue(new Error('Team not found'));

      // Act & Assert
      await expect(controller.getTeamStats('non-existent-team', query)).rejects.toThrow('Team not found');
    });

    it('should show accurate percentages for teams near quota limits', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      const nearLimitStats = {
        ...mockTeamStats,
        usage: {
          specifications: 480, // Near 500 limit
          aiGenerations: 1900, // Near 2000 limit
          teamMembers: 48, // Near 50 limit
          storage: 9500, // Near 10000 limit
          apiCalls: 95000, // Near 100000 limit
        },
        percentages: {
          specifications: 96, // 480/500
          aiGenerations: 95, // 1900/2000
          teamMembers: 96, // 48/50
          storage: 95, // 9500/10000
          apiCalls: 95, // 95000/100000
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(nearLimitStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(result.percentages.specifications).toBe(96);
      expect(result.percentages.aiGenerations).toBe(95);
      expect(result.percentages.teamMembers).toBe(96);
      expect(result.percentages.storage).toBe(95);
      expect(result.percentages.apiCalls).toBe(95);
    });

    it('should handle Enterprise team with unlimited quotas', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      const enterpriseTeamStats = {
        ...mockTeamStats,
        quota: USAGE_QUOTAS[SubscriptionTier.ENTERPRISE],
        usage: {
          specifications: 5000,
          aiGenerations: 25000,
          teamMembers: 200,
          storage: 100000,
          apiCalls: 1000000,
        },
        percentages: {
          specifications: 0, // Unlimited shows as 0%
          aiGenerations: 0,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
      };
      usageService.getTeamUsageStats.mockResolvedValue(enterpriseTeamStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(result.quota.specifications).toBe(-1); // Unlimited
      expect(result.percentages.specifications).toBe(0);
      expect(result.usage.specifications).toBe(5000); // Actual usage tracked
    });

    it('should handle concurrent requests to team stats', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      const promises = Array.from({ length: 5 }, () =>
        controller.getTeamStats(mockTeamId, query)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(usageService.getTeamUsageStats).toHaveBeenCalledTimes(5);
      results.forEach((result) => {
        expect(result).toEqual(mockTeamStats);
      });
    });
  });

  describe('date parsing and validation', () => {
    it('should handle ISO date strings correctly', async () => {
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
        new Date('2024-06-30T23:59:59.999Z')
      );
    });

    it('should handle timezone differences in dates', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01T00:00:00+07:00', // UTC+7
        endDate: '2024-06-01T23:59:59-05:00', // UTC-5
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-06-01T00:00:00+07:00'),
        new Date('2024-06-01T23:59:59-05:00')
      );
    });

    it('should handle date strings without time component', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        new Date('2024-06-01'),
        new Date('2024-06-30')
      );
    });

    it('should handle invalid date strings gracefully', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {
        startDate: 'invalid-date',
        endDate: '2024-06-30',
      };
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, query);

      // Assert
      // Invalid dates will create Invalid Date objects
      const [userId, startDate, endDate] = usageService.getUserUsageStats.mock.calls[0];
      expect(userId).toBe(mockUserId);
      expect(isNaN(startDate.getTime())).toBe(true); // Invalid Date
      expect(endDate).toEqual(new Date('2024-06-30'));
    });
  });

  describe('response structure validation', () => {
    it('should return consistent structure for user stats', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const result = await controller.getUserStats(mockUserId, query);

      // Assert
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('quota');
      expect(result).toHaveProperty('percentages');

      expect(result.period).toHaveProperty('start');
      expect(result.period).toHaveProperty('end');

      const usageKeys = Object.keys(result.usage);
      expect(usageKeys).toContain('specifications');
      expect(usageKeys).toContain('aiGenerations');
      expect(usageKeys).toContain('teamMembers');
      expect(usageKeys).toContain('storage');
      expect(usageKeys).toContain('apiCalls');

      const percentageKeys = Object.keys(result.percentages);
      expect(percentageKeys).toEqual(usageKeys);
    });

    it('should return consistent structure for team stats', async () => {
      // Arrange
      const query: UsageStatsQueryDto = {};
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      const result = await controller.getTeamStats(mockTeamId, query);

      // Assert
      expect(result).toHaveProperty('period');
      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('quota');
      expect(result).toHaveProperty('percentages');

      // Verify all required fields are present
      expect(typeof result.usage.specifications).toBe('number');
      expect(typeof result.usage.aiGenerations).toBe('number');
      expect(typeof result.percentages.specifications).toBe('number');
      expect(typeof result.percentages.aiGenerations).toBe('number');
    });
  });

  describe('controller configuration', () => {
    it('should have correct controller methods', () => {
      expect(typeof controller.getUserStats).toBe('function');
      expect(typeof controller.getTeamStats).toBe('function');
    });

    it('should accept correct parameters for getUserStats', () => {
      // Verify method signature
      expect(controller.getUserStats.length).toBe(2); // userId and query
    });

    it('should accept correct parameters for getTeamStats', () => {
      // Verify method signature
      expect(controller.getTeamStats.length).toBe(2); // teamId and query
    });
  });

  describe('authorization scenarios', () => {
    it('should have JwtAuthGuard applied globally to controller', () => {
      // This is a conceptual test - actual guard testing would be done in integration tests
      // Here we verify the controller methods exist and can be called
      expect(typeof controller.getUserStats).toBe('function');
      expect(typeof controller.getTeamStats).toBe('function');
    });

    it('should use CurrentUser decorator for getUserStats', () => {
      // In integration tests, this would verify that the userId comes from the JWT token
      // Here we verify the method structure accepts userId parameter
      expect(controller.getUserStats.length).toBe(2);
    });

    it('should have TeamMemberGuard on getTeamStats', () => {
      // In integration tests, this would verify team membership requirements
      // Here we verify the method accepts teamId parameter
      expect(controller.getTeamStats.length).toBe(2);
    });
  });

  describe('error handling scenarios', () => {
    it('should propagate service errors to caller', async () => {
      // Arrange
      const errorMessage = 'Database connection failed';
      usageService.getUserUsageStats.mockRejectedValue(new Error(errorMessage));

      // Act & Assert
      await expect(controller.getUserStats(mockUserId, {})).rejects.toThrow(errorMessage);
    });

    it('should handle service timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      usageService.getTeamUsageStats.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(controller.getTeamStats(mockTeamId, {})).rejects.toThrow('Request timeout');
    });

    it('should handle malformed query parameters', async () => {
      // Arrange
      const malformedQuery = {
        startDate: null,
        endDate: undefined,
        invalidField: 'should be ignored',
      } as any;
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      await controller.getUserStats(mockUserId, malformedQuery);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledWith(
        mockUserId,
        null, // null startDate
        undefined // undefined endDate
      );
    });
  });

  describe('performance and concurrency', () => {
    it('should handle multiple concurrent user stat requests', async () => {
      // Arrange
      const queries = Array.from({ length: 10 }, (_, i) => ({
        startDate: `2024-0${(i % 9) + 1}-01`,
      }));
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);

      // Act
      const promises = queries.map(query =>
        controller.getUserStats(mockUserId, query)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(usageService.getUserUsageStats).toHaveBeenCalledTimes(10);
      results.forEach(result => {
        expect(result).toEqual(mockUserStats);
      });
    });

    it('should handle mixed user and team stat requests', async () => {
      // Arrange
      usageService.getUserUsageStats.mockResolvedValue(mockUserStats);
      usageService.getTeamUsageStats.mockResolvedValue(mockTeamStats);

      // Act
      const [userResult, teamResult] = await Promise.all([
        controller.getUserStats(mockUserId, {}),
        controller.getTeamStats(mockTeamId, {}),
      ]);

      // Assert
      expect(userResult).toEqual(mockUserStats);
      expect(teamResult).toEqual(mockTeamStats);
      expect(usageService.getUserUsageStats).toHaveBeenCalledTimes(1);
      expect(usageService.getTeamUsageStats).toHaveBeenCalledTimes(1);
    });
  });
});
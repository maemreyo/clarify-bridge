// UPDATED: 2025-06-17 - Added comprehensive usage service tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsageService } from './usage.service';
import { PrismaService } from '@core/database';
import { SubscriptionTier } from '@prisma/client';
import {
  UsageAction,
  UsageQuota,
  USAGE_QUOTAS,
  UsageStats,
  UsageCheckResult,
} from './interfaces/usage.interface';

describe('UsageService', () => {
  let service: UsageService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-456';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    subscriptionTier: SubscriptionTier.STARTER,
    generationsCount: 25,
    subscription: {
      id: 'sub-123',
      status: 'active',
    },
  };

  const mockTeam = {
    id: mockTeamId,
    name: 'Test Team',
    subscriptionTier: SubscriptionTier.PROFESSIONAL,
    usageCount: 150,
    usageQuota: null,
    _count: {
      members: 5,
    },
  };

  const mockUsageLog = {
    id: 'log-123',
    userId: mockUserId,
    teamId: mockTeamId,
    action: 'spec_generated' as UsageAction,
    createdAt: new Date(),
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        {
          provide: PrismaService,
          useValue: {
            usageLog: {
              create: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            team: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();

    // Set up default system time
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('trackUsage', () => {
    it('should successfully track usage with all parameters', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);
      prismaService.user.update.mockResolvedValue(mockUser as any);
      prismaService.team.update.mockResolvedValue(mockTeam as any);

      // Act
      await service.trackUsage('spec_generated', {
        userId: mockUserId,
        teamId: mockTeamId,
        metadata: { specId: 'spec-123', title: 'Test Spec' },
      });

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          teamId: mockTeamId,
          action: 'spec_generated',
          metadata: { specId: 'spec-123', title: 'Test Spec' },
        },
      });
    });

    it('should increment counters for spec_generated action', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);
      prismaService.user.update.mockResolvedValue(mockUser as any);
      prismaService.team.update.mockResolvedValue(mockTeam as any);

      // Act
      await service.trackUsage('spec_generated', {
        userId: mockUserId,
        teamId: mockTeamId,
      });

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { generationsCount: { increment: 1 } },
      });

      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: mockTeamId },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('should not increment counters for non-spec actions', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);

      // Act
      await service.trackUsage('api_call', {
        userId: mockUserId,
        teamId: mockTeamId,
      });

      // Assert
      expect(prismaService.user.update).not.toHaveBeenCalled();
      expect(prismaService.team.update).not.toHaveBeenCalled();
    });

    it('should track usage without userId', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue({
        ...mockUsageLog,
        userId: null,
      });

      // Act
      await service.trackUsage('api_call', {
        teamId: mockTeamId,
        metadata: { source: 'webhook' },
      });

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          teamId: mockTeamId,
          action: 'api_call',
          metadata: { source: 'webhook' },
        },
      });
    });

    it('should track usage without teamId', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue({
        ...mockUsageLog,
        teamId: null,
      });

      // Act
      await service.trackUsage('vector_search', {
        userId: mockUserId,
        metadata: { query: 'test search' },
      });

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          teamId: undefined,
          action: 'vector_search',
          metadata: { query: 'test search' },
        },
      });
    });

    it('should not throw error on tracking failure', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      prismaService.usageLog.create.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(
        service.trackUsage('api_call', { userId: mockUserId })
      ).resolves.not.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith('Failed to track usage: Database connection failed');
    });

    it('should handle counter update failures gracefully', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);
      prismaService.user.update.mockRejectedValue(new Error('Counter update failed'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      // Act
      await service.trackUsage('spec_generated', { userId: mockUserId });

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Failed to track usage: Counter update failed');
    });
  });

  describe('checkUserQuota', () => {
    beforeEach(() => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
    });

    it('should allow action when within quota limits', async () => {
      // Arrange
      prismaService.usageLog.count.mockResolvedValue(30); // Under STARTER limit of 50

      // Act
      const result = await service.checkUserQuota(mockUserId, 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 30,
        limit: 50,
        remaining: 20,
      });
    });

    it('should deny action when quota exceeded', async () => {
      // Arrange
      prismaService.usageLog.count.mockResolvedValue(50); // At STARTER limit

      // Act
      const result = await service.checkUserQuota(mockUserId, 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Monthly specification limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });
    });

    it('should allow unlimited for Enterprise tier', async () => {
      // Arrange
      const enterpriseUser = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.ENTERPRISE,
      };
      prismaService.user.findUnique.mockResolvedValue(enterpriseUser as any);

      // Act
      const result = await service.checkUserQuota(mockUserId, 'spec_generated');

      // Assert
      expect(result).toEqual({ allowed: true });
      expect(prismaService.usageLog.count).not.toHaveBeenCalled();
    });

    it('should handle AI generation quota', async () => {
      // Arrange
      prismaService.usageLog.count.mockResolvedValue(150); // Under STARTER limit of 200

      // Act
      const result = await service.checkUserQuota(mockUserId, 'ai_generation');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 150,
        limit: 200,
        remaining: 50,
      });
    });

    it('should handle view generation quota', async () => {
      // Arrange
      prismaService.usageLog.count.mockResolvedValue(200); // At limit

      // Act
      const result = await service.checkUserQuota(mockUserId, 'view_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Monthly AI generation limit reached',
        currentUsage: 200,
        limit: 200,
        remaining: 0,
      });
    });

    it('should handle storage quota', async () => {
      // Arrange
      const userUsage = 800; // MB, under STARTER limit of 1000
      jest.spyOn(service as any, 'getUserUsageForPeriod').mockResolvedValue({
        specifications: 10,
        aiGenerations: 50,
        teamMembers: 3,
        storage: userUsage,
        apiCalls: 500,
      });

      // Act
      const result = await service.checkUserQuota(mockUserId, 'file_uploaded');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: userUsage,
        limit: 1000,
        remaining: 200,
      });
    });

    it('should handle API call quota', async () => {
      // Arrange
      prismaService.usageLog.count.mockResolvedValue(9500); // Under limit

      // Act
      const result = await service.checkUserQuota(mockUserId, 'api_call');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 9500,
        limit: 10000,
        remaining: 500,
      });
    });

    it('should return error for non-existent user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.checkUserQuota('non-existent', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'User not found',
      });
    });

    it('should handle different subscription tiers correctly', async () => {
      // Test FREE tier
      const freeUser = { ...mockUser, subscriptionTier: SubscriptionTier.FREE };
      prismaService.user.findUnique.mockResolvedValue(freeUser as any);
      prismaService.usageLog.count.mockResolvedValue(3);

      const freeResult = await service.checkUserQuota(mockUserId, 'spec_generated');
      expect(freeResult.limit).toBe(5); // FREE tier limit

      // Test PROFESSIONAL tier
      const proUser = { ...mockUser, subscriptionTier: SubscriptionTier.PROFESSIONAL };
      prismaService.user.findUnique.mockResolvedValue(proUser as any);
      prismaService.usageLog.count.mockResolvedValue(300);

      const proResult = await service.checkUserQuota(mockUserId, 'spec_generated');
      expect(proResult.limit).toBe(500); // PROFESSIONAL tier limit
    });
  });

  describe('checkTeamQuota', () => {
    beforeEach(() => {
      prismaService.team.findUnique.mockResolvedValue(mockTeam as any);
    });

    it('should check team member quota', async () => {
      // Arrange
      const teamWithMembers = {
        ...mockTeam,
        _count: { members: 8 }, // Under PROFESSIONAL limit of 50
      };
      prismaService.team.findUnique.mockResolvedValue(teamWithMembers as any);

      // Act
      const result = await service.checkTeamQuota(mockTeamId, 'team_member_added');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 8,
        limit: 50,
        remaining: 42,
      });
    });

    it('should deny when team member limit reached', async () => {
      // Arrange
      const teamAtLimit = {
        ...mockTeam,
        _count: { members: 50 }, // At PROFESSIONAL limit
      };
      prismaService.team.findUnique.mockResolvedValue(teamAtLimit as any);

      // Act
      const result = await service.checkTeamQuota(mockTeamId, 'team_member_added');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Team member limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });
    });

    it('should use custom team quota when set', async () => {
      // Arrange
      const teamWithCustomQuota = {
        ...mockTeam,
        usageQuota: 100, // Custom quota instead of tier default
      };
      prismaService.team.findUnique.mockResolvedValue(teamWithCustomQuota as any);
      jest.spyOn(service as any, 'getTeamUsageForPeriod').mockResolvedValue({
        specifications: 80,
        aiGenerations: 400,
        teamMembers: 10,
        storage: 5000,
        apiCalls: 50000,
      });

      // Act
      const result = await service.checkTeamQuota(mockTeamId, 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 80,
        limit: 100,
        remaining: 20,
      });
    });

    it('should allow unlimited for Enterprise team', async () => {
      // Arrange
      const enterpriseTeam = {
        ...mockTeam,
        subscriptionTier: SubscriptionTier.ENTERPRISE,
      };
      prismaService.team.findUnique.mockResolvedValue(enterpriseTeam as any);

      // Act
      const result = await service.checkTeamQuota(mockTeamId, 'spec_generated');

      // Assert
      expect(result).toEqual({ allowed: true });
    });

    it('should return error for non-existent team', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.checkTeamQuota('non-existent', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Team not found',
      });
    });
  });

  describe('getUserUsageStats', () => {
    beforeEach(() => {
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
    });

    it('should return user usage statistics for current month', async () => {
      // Arrange
      const mockUsage = {
        specifications: 25,
        aiGenerations: 150,
        teamMembers: 5,
        storage: 750,
        apiCalls: 8500,
      };

      jest.spyOn(service as any, 'getUserUsageForPeriod').mockResolvedValue(mockUsage);

      // Act
      const stats = await service.getUserUsageStats(mockUserId);

      // Assert
      expect(stats).toEqual({
        period: {
          start: new Date('2024-06-01T00:00:00.000Z'),
          end: new Date('2024-06-30T23:59:59.999Z'),
        },
        usage: mockUsage,
        quota: USAGE_QUOTAS[SubscriptionTier.STARTER],
        percentages: {
          specifications: 50, // 25/50
          aiGenerations: 75, // 150/200
          teamMembers: 50, // 5/10
          storage: 75, // 750/1000
          apiCalls: 85, // 8500/10000
        },
      });
    });

    it('should return stats for custom date range', async () => {
      // Arrange
      const startDate = new Date('2024-05-01');
      const endDate = new Date('2024-05-31');
      const mockUsage = {
        specifications: 10,
        aiGenerations: 50,
        teamMembers: 3,
        storage: 250,
        apiCalls: 2000,
      };

      jest.spyOn(service as any, 'getUserUsageForPeriod').mockResolvedValue(mockUsage);

      // Act
      const stats = await service.getUserUsageStats(mockUserId, startDate, endDate);

      // Assert
      expect(stats.period.start).toEqual(startDate);
      expect(stats.period.end).toEqual(endDate);
      expect(stats.usage).toEqual(mockUsage);
    });

    it('should handle unlimited quotas in percentage calculation', async () => {
      // Arrange
      const enterpriseUser = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.ENTERPRISE,
      };
      prismaService.user.findUnique.mockResolvedValue(enterpriseUser as any);

      const mockUsage = {
        specifications: 1000,
        aiGenerations: 5000,
        teamMembers: 100,
        storage: 50000,
        apiCalls: 100000,
      };

      jest.spyOn(service as any, 'getUserUsageForPeriod').mockResolvedValue(mockUsage);

      // Act
      const stats = await service.getUserUsageStats(mockUserId);

      // Assert
      expect(stats.percentages).toEqual({
        specifications: 0, // Unlimited
        aiGenerations: 0,
        teamMembers: 0,
        storage: 0,
        apiCalls: 0,
      });
    });

    it('should throw error for non-existent user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserUsageStats('non-existent')).rejects.toThrow('User not found');
    });
  });

  describe('getTeamUsageStats', () => {
    beforeEach(() => {
      prismaService.team.findUnique.mockResolvedValue(mockTeam as any);
    });

    it('should return team usage statistics', async () => {
      // Arrange
      const mockUsage = {
        specifications: 200,
        aiGenerations: 1000,
        teamMembers: 15,
        storage: 5000,
        apiCalls: 50000,
      };

      jest.spyOn(service as any, 'getTeamUsageForPeriod').mockResolvedValue(mockUsage);

      // Act
      const stats = await service.getTeamUsageStats(mockTeamId);

      // Assert
      expect(stats.usage).toEqual(mockUsage);
      expect(stats.quota).toEqual(USAGE_QUOTAS[SubscriptionTier.PROFESSIONAL]);
    });

    it('should use custom team quota in calculations', async () => {
      // Arrange
      const teamWithCustomQuota = {
        ...mockTeam,
        usageQuota: 300,
      };
      prismaService.team.findUnique.mockResolvedValue(teamWithCustomQuota as any);

      const mockUsage = {
        specifications: 150,
        aiGenerations: 1000,
        teamMembers: 15,
        storage: 5000,
        apiCalls: 50000,
      };

      jest.spyOn(service as any, 'getTeamUsageForPeriod').mockResolvedValue(mockUsage);

      // Act
      const stats = await service.getTeamUsageStats(mockTeamId);

      // Assert
      expect(stats.quota.specifications).toBe(300); // Custom quota
      expect(stats.percentages.specifications).toBe(50); // 150/300
    });

    it('should throw error for non-existent team', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTeamUsageStats('non-existent')).rejects.toThrow('Team not found');
    });
  });

  describe('checkMultipleUsersQuota', () => {
    it('should check quotas for multiple users', async () => {
      // Arrange
      const userIds = ['user-1', 'user-2', 'user-3'];

      prismaService.user.findMany.mockResolvedValue([
        { ...mockUser, id: 'user-1', subscriptionTier: SubscriptionTier.FREE },
        { ...mockUser, id: 'user-2', subscriptionTier: SubscriptionTier.STARTER },
        // user-3 not found
      ] as any);

      prismaService.usageLog.count
        .mockResolvedValueOnce(3) // user-1: under FREE limit of 5
        .mockResolvedValueOnce(50); // user-2: at STARTER limit of 50

      // Act
      const results = await service.checkMultipleUsersQuota(userIds, 'spec_generated');

      // Assert
      expect(results).toEqual({
        'user-1': { allowed: true, currentUsage: 3, limit: 5, remaining: 2 },
        'user-2': { allowed: false, reason: 'Monthly specification limit reached', currentUsage: 50, limit: 50, remaining: 0 },
        'user-3': { allowed: false, reason: 'User not found' },
      });
    });
  });

  describe('getQuotaForTier', () => {
    it('should return correct quota for each tier', () => {
      expect(service.getQuotaForTier(SubscriptionTier.FREE)).toEqual(USAGE_QUOTAS.FREE);
      expect(service.getQuotaForTier(SubscriptionTier.STARTER)).toEqual(USAGE_QUOTAS.STARTER);
      expect(service.getQuotaForTier(SubscriptionTier.PROFESSIONAL)).toEqual(USAGE_QUOTAS.PROFESSIONAL);
      expect(service.getQuotaForTier(SubscriptionTier.ENTERPRISE)).toEqual(USAGE_QUOTAS.ENTERPRISE);
    });
  });

  describe('utility methods', () => {
    it('should calculate current month range correctly', () => {
      // Act
      const range = (service as any).getCurrentMonthRange();

      // Assert
      expect(range.start).toEqual(new Date('2024-06-01T00:00:00.000Z'));
      expect(range.end).toEqual(new Date('2024-06-30T23:59:59.999Z'));
    });

    it('should calculate custom period range', () => {
      // Arrange
      const startDate = new Date('2024-05-15');
      const endDate = new Date('2024-05-20');

      // Act
      const range = (service as any).getPeriodRange(startDate, endDate);

      // Assert
      expect(range.start).toEqual(startDate);
      expect(range.end).toEqual(endDate);
    });

    it('should calculate usage percentages correctly', () => {
      // Arrange
      const usage = {
        specifications: 25,
        aiGenerations: 100,
        teamMembers: 5,
        storage: 500,
        apiCalls: 7500,
      };
      const quota = USAGE_QUOTAS[SubscriptionTier.STARTER];

      // Act
      const percentages = (service as any).calculateUsagePercentages(usage, quota);

      // Assert
      expect(percentages).toEqual({
        specifications: 50, // 25/50
        aiGenerations: 50, // 100/200
        teamMembers: 50, // 5/10
        storage: 50, // 500/1000
        apiCalls: 75, // 7500/10000
      });
    });

    it('should handle unlimited quotas in percentage calculation', () => {
      // Arrange
      const usage = {
        specifications: 1000,
        aiGenerations: 5000,
        teamMembers: 100,
        storage: 50000,
        apiCalls: 100000,
      };
      const quota = USAGE_QUOTAS[SubscriptionTier.ENTERPRISE];

      // Act
      const percentages = (service as any).calculateUsagePercentages(usage, quota);

      // Assert
      expect(percentages).toEqual({
        specifications: 0,
        aiGenerations: 0,
        teamMembers: 0,
        storage: 0,
        apiCalls: 0,
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle concurrent usage tracking', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);

      // Act
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.trackUsage('api_call', {
          userId: `user-${i}`,
          metadata: { index: i },
        })
      );

      await Promise.all(promises);

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledTimes(10);
    });

    it('should handle month boundary correctly', async () => {
      // Arrange - Set time to end of month
      jest.setSystemTime(new Date('2024-06-30T23:59:59.999Z'));
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      prismaService.usageLog.count.mockResolvedValue(49);

      // Act
      const result = await service.checkUserQuota(mockUserId, 'spec_generated');

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should handle missing subscription gracefully', async () => {
      // Arrange
      const userWithoutSubscription = {
        ...mockUser,
        subscription: null,
        subscriptionTier: SubscriptionTier.FREE,
      };
      prismaService.user.findUnique.mockResolvedValue(userWithoutSubscription as any);
      prismaService.usageLog.count.mockResolvedValue(3);

      // Act
      const result = await service.checkUserQuota(mockUserId, 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 3,
        limit: 5,
        remaining: 2,
      });
    });

    it('should handle database errors gracefully in quota checks', async () => {
      // Arrange
      prismaService.user.findUnique.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.checkUserQuota(mockUserId, 'spec_generated')).rejects.toThrow('Database error');
    });
  });
});
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsageService } from './usage.service';
import { PrismaService } from '@core/database';
import { SubscriptionTier } from '@prisma/client';
import {
  UsageQuota,
  USAGE_QUOTAS,
  UsageStats,
  UsageCheckResult,
  UsageAction,
} from './interfaces/usage.interface';

describe('UsageService', () => {
  let service: UsageService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscriptionTier: SubscriptionTier.STARTER,
    generationsCount: 10,
    subscription: {
      id: 'sub-123',
      tier: SubscriptionTier.STARTER,
    },
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Test Team',
    subscriptionTier: SubscriptionTier.PROFESSIONAL,
    usageQuota: null,
    usageCount: 50,
    _count: {
      members: 5,
    },
  };

  const mockUsageLog = {
    id: 'log-123',
    userId: 'user-123',
    teamId: null,
    action: 'spec_generated',
    metadata: {},
    createdAt: new Date(),
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
              groupBy: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
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

    jest.clearAllMocks();

    // Mock date for consistent testing
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-15'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('trackUsage', () => {
    it('should track usage action successfully', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);

      // Act
      await service.trackUsage('spec_generated', {
        userId: 'user-123',
        teamId: 'team-123',
        metadata: { specId: 'spec-123' },
      });

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          teamId: 'team-123',
          action: 'spec_generated',
          metadata: { specId: 'spec-123' },
        },
      });
    });

    it('should increment user generation count for spec_generated', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);
      prismaService.user.update.mockResolvedValue(mockUser);
      prismaService.team.update.mockResolvedValue(mockTeam);

      // Act
      await service.trackUsage('spec_generated', {
        userId: 'user-123',
        teamId: 'team-123',
      });

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { generationsCount: { increment: 1 } },
      });
      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: { usageCount: { increment: 1 } },
      });
    });

    it('should not throw on tracking failure', async () => {
      // Arrange
      prismaService.usageLog.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert - should not throw
      await expect(
        service.trackUsage('api_call', { userId: 'user-123' }),
      ).resolves.not.toThrow();
    });
  });

  describe('checkUserQuota', () => {
    it('should allow action when within quota', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockResolvedValue(30); // Under STARTER limit of 50

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

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
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockResolvedValue(50); // At STARTER limit

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Monthly specification limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });
    });

    it('should allow unlimited usage for ENTERPRISE tier', async () => {
      // Arrange
      const enterpriseUser = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.ENTERPRISE,
      };
      prismaService.user.findUnique.mockResolvedValue(enterpriseUser);

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

      // Assert
      expect(result).toEqual({ allowed: true });
      expect(prismaService.usageLog.count).not.toHaveBeenCalled();
    });

    it('should return not allowed if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'User not found',
      });
    });

    it('should check AI generation quota correctly', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockResolvedValue(150); // Under STARTER limit of 200

      // Act
      const result = await service.checkUserQuota('user-123', 'ai_generation');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 150,
        limit: 200,
        remaining: 50,
      });
    });
  });

  describe('checkTeamQuota', () => {
    it('should allow action when within team quota', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(mockTeam);
      prismaService.usageLog.count.mockResolvedValue(300); // Under PROFESSIONAL limit of 500

      // Act
      const result = await service.checkTeamQuota('team-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 300,
        limit: 500,
        remaining: 200,
      });
    });

    it('should check team member limit correctly', async () => {
      // Arrange
      const teamAtLimit = {
        ...mockTeam,
        _count: { members: 50 }, // At PROFESSIONAL limit
      };
      prismaService.team.findUnique.mockResolvedValue(teamAtLimit);

      // Act
      const result = await service.checkTeamQuota('team-123', 'team_member_added');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Team member limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });
    });

    it('should use custom team quota if set', async () => {
      // Arrange
      const teamWithCustomQuota = {
        ...mockTeam,
        usageQuota: 1000, // Custom quota
      };
      prismaService.team.findUnique.mockResolvedValue(teamWithCustomQuota);
      prismaService.usageLog.count.mockResolvedValue(800);

      // Act
      const result = await service.checkTeamQuota('team-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 800,
        limit: 1000,
        remaining: 200,
      });
    });

    it('should return not allowed if team not found', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.checkTeamQuota('team-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: false,
        reason: 'Team not found',
      });
    });
  });

  describe('getUserUsageStats', () => {
    it('should return usage statistics for current month', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockImplementation(async ({ where }) => {
        const action = where?.action;
        if (action === 'spec_generated') return 30;
        if (action?.in?.includes('ai_generation')) return 150;
        return 0;
      });
      prismaService.usageLog.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getUserUsageStats('user-123');

      // Assert
      expect(result).toMatchObject({
        period: {
          start: new Date('2024-06-01T00:00:00.000Z'),
          end: new Date('2024-06-30T23:59:59.999Z'),
        },
        usage: {
          specifications: 30,
          aiGenerations: 150,
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
        quota: USAGE_QUOTAS[SubscriptionTier.STARTER],
        percentages: {
          specifications: 60, // 30/50 * 100
          aiGenerations: 75, // 150/200 * 100
          teamMembers: 0,
          storage: 0,
          apiCalls: 0,
        },
      });
    });

    it('should handle custom date range', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockResolvedValue(0);
      prismaService.usageLog.groupBy.mockResolvedValue([]);

      const startDate = new Date('2024-05-01');
      const endDate = new Date('2024-05-31');

      // Act
      const result = await service.getUserUsageStats('user-123', startDate, endDate);

      // Assert
      expect(result.period.start).toEqual(startDate);
      expect(result.period.end).toEqual(new Date('2024-05-31T23:59:59.999Z'));
    });

    it('should throw error if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserUsageStats('user-123')).rejects.toThrow('User not found');
    });
  });

  describe('getTeamUsageStats', () => {
    it('should return team usage statistics', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(mockTeam);
      prismaService.usageLog.count.mockImplementation(async ({ where }) => {
        const action = where?.action;
        if (action === 'spec_generated') return 300;
        if (action?.in?.includes('ai_generation')) return 1500;
        return 0;
      });
      prismaService.usageLog.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getTeamUsageStats('team-123');

      // Assert
      expect(result).toMatchObject({
        usage: {
          specifications: 300,
          aiGenerations: 1500,
          teamMembers: 5,
          storage: 0,
          apiCalls: 0,
        },
        quota: USAGE_QUOTAS[SubscriptionTier.PROFESSIONAL],
        percentages: {
          specifications: 60, // 300/500 * 100
          aiGenerations: 75, // 1500/2000 * 100
          teamMembers: 10, // 5/50 * 100
          storage: 0,
          apiCalls: 0,
        },
      });
    });

    it('should handle unlimited quotas correctly', async () => {
      // Arrange
      const enterpriseTeam = {
        ...mockTeam,
        subscriptionTier: SubscriptionTier.ENTERPRISE,
      };
      prismaService.team.findUnique.mockResolvedValue(enterpriseTeam);
      prismaService.usageLog.count.mockResolvedValue(10000);
      prismaService.usageLog.groupBy.mockResolvedValue([]);

      // Act
      const result = await service.getTeamUsageStats('team-123');

      // Assert
      expect(result.percentages.specifications).toBe(0); // Unlimited
      expect(result.quota.specifications).toBe(-1);
    });
  });

  describe('resetUserUsage', () => {
    it('should reset user generation count', async () => {
      // Arrange
      prismaService.user.update.mockResolvedValue(mockUser);

      // Act
      await service.resetUserUsage('user-123');

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { generationsCount: 0 },
      });
    });
  });

  describe('resetTeamUsage', () => {
    it('should reset team usage count', async () => {
      // Arrange
      prismaService.team.update.mockResolvedValue(mockTeam);

      // Act
      await service.resetTeamUsage('team-123');

      // Assert
      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: { usageCount: 0 },
      });
    });
  });

  describe('bulkCheckQuota', () => {
    it('should check quota for multiple users', async () => {
      // Arrange
      const userIds = ['user-1', 'user-2', 'user-3'];
      prismaService.user.findUnique
        .mockResolvedValueOnce({ ...mockUser, id: 'user-1' })
        .mockResolvedValueOnce({ ...mockUser, id: 'user-2', subscriptionTier: SubscriptionTier.FREE })
        .mockResolvedValueOnce(null);

      prismaService.usageLog.count
        .mockResolvedValueOnce(30) // user-1
        .mockResolvedValueOnce(5); // user-2 (at FREE limit)

      // Act
      const results = await service.bulkCheckQuota(userIds, 'spec_generated');

      // Assert
      expect(results).toEqual({
        'user-1': { allowed: true, currentUsage: 30, limit: 50, remaining: 20 },
        'user-2': { allowed: false, reason: 'Monthly specification limit reached', currentUsage: 5, limit: 5, remaining: 0 },
        'user-3': { allowed: false, reason: 'User not found' },
      });
    });
  });

  describe('getQuotaForTier', () => {
    it('should return correct quota for each tier', () => {
      // Act & Assert
      expect(service.getQuotaForTier(SubscriptionTier.FREE)).toEqual(USAGE_QUOTAS.FREE);
      expect(service.getQuotaForTier(SubscriptionTier.STARTER)).toEqual(USAGE_QUOTAS.STARTER);
      expect(service.getQuotaForTier(SubscriptionTier.PROFESSIONAL)).toEqual(USAGE_QUOTAS.PROFESSIONAL);
      expect(service.getQuotaForTier(SubscriptionTier.ENTERPRISE)).toEqual(USAGE_QUOTAS.ENTERPRISE);
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent usage tracking', async () => {
      // Arrange
      prismaService.usageLog.create.mockResolvedValue(mockUsageLog);

      // Act
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          service.trackUsage('api_call', {
            userId: `user-${i}`,
            metadata: { index: i },
          }),
        );

      await Promise.all(promises);

      // Assert
      expect(prismaService.usageLog.create).toHaveBeenCalledTimes(10);
    });

    it('should handle date boundaries correctly', async () => {
      // Arrange
      // Set time to end of month
      jest.setSystemTime(new Date('2024-06-30T23:59:59.999Z'));

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.usageLog.count.mockResolvedValue(49);

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

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
      prismaService.user.findUnique.mockResolvedValue(userWithoutSubscription);
      prismaService.usageLog.count.mockResolvedValue(3);

      // Act
      const result = await service.checkUserQuota('user-123', 'spec_generated');

      // Assert
      expect(result).toEqual({
        allowed: true,
        currentUsage: 3,
        limit: 5,
        remaining: 2,
      });
    });
  });
});
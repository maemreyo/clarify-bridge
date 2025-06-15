// Updated: Usage tracking and quota management service

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database';
import { SubscriptionTier } from '@prisma/client';
import {
  UsageQuota,
  USAGE_QUOTAS,
  UsageStats,
  UsageCheckResult,
  UsageAction,
} from './interfaces/usage.interface';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Track usage action
   */
  async trackUsage(
    action: UsageAction,
    options: {
      userId?: string;
      teamId?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      await this.prisma.usageLog.create({
        data: {
          userId: options.userId,
          teamId: options.teamId,
          action,
          metadata: options.metadata,
        },
      });

      // Update cached counters if needed
      if (action === 'spec_generated') {
        if (options.userId) {
          await this.prisma.user.update({
            where: { id: options.userId },
            data: { generationsCount: { increment: 1 } },
          });
        }
        if (options.teamId) {
          await this.prisma.team.update({
            where: { id: options.teamId },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      this.logger.debug(`Tracked usage: ${action} for user ${options.userId} team ${options.teamId}`);
    } catch (error) {
      this.logger.error(`Failed to track usage: ${error.message}`);
      // Don't throw - usage tracking should not break the main flow
    }
  }

  /**
   * Check if user can perform action based on quota
   */
  async checkUserQuota(
    userId: string,
    action: UsageAction,
  ): Promise<UsageCheckResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    const tier = user.subscriptionTier;
    const quota = USAGE_QUOTAS[tier];

    // Enterprise has unlimited usage
    if (tier === SubscriptionTier.ENTERPRISE) {
      return { allowed: true };
    }

    // Get current period usage
    const currentMonth = this.getCurrentMonthRange();
    const usage = await this.getUserUsageForPeriod(userId, currentMonth.start, currentMonth.end);

    // Check specific action limits
    switch (action) {
      case 'spec_generated':
        if (quota.specifications === -1) return { allowed: true };
        if (usage.specifications >= quota.specifications) {
          return {
            allowed: false,
            reason: 'Monthly specification limit reached',
            currentUsage: usage.specifications,
            limit: quota.specifications,
            remaining: 0,
          };
        }
        return {
          allowed: true,
          currentUsage: usage.specifications,
          limit: quota.specifications,
          remaining: quota.specifications - usage.specifications,
        };

      case 'ai_generation':
      case 'view_generated':
        if (quota.aiGenerations === -1) return { allowed: true };
        if (usage.aiGenerations >= quota.aiGenerations) {
          return {
            allowed: false,
            reason: 'Monthly AI generation limit reached',
            currentUsage: usage.aiGenerations,
            limit: quota.aiGenerations,
            remaining: 0,
          };
        }
        return {
          allowed: true,
          currentUsage: usage.aiGenerations,
          limit: quota.aiGenerations,
          remaining: quota.aiGenerations - usage.aiGenerations,
        };

      case 'api_call':
        if (quota.apiCalls === -1) return { allowed: true };
        if (usage.apiCalls >= quota.apiCalls) {
          return {
            allowed: false,
            reason: 'Monthly API call limit reached',
            currentUsage: usage.apiCalls,
            limit: quota.apiCalls,
            remaining: 0,
          };
        }
        return {
          allowed: true,
          currentUsage: usage.apiCalls,
          limit: quota.apiCalls,
          remaining: quota.apiCalls - usage.apiCalls,
        };

      default:
        return { allowed: true };
    }
  }

  /**
   * Check if team can perform action based on quota
   */
  async checkTeamQuota(
    teamId: string,
    action: UsageAction,
  ): Promise<UsageCheckResult> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          include: { subscription: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      return { allowed: false, reason: 'Team not found' };
    }

    // Team quota is based on owner's subscription
    const tier = team.owner.subscriptionTier;
    const quota = USAGE_QUOTAS[tier];

    // Enterprise has unlimited usage
    if (tier === SubscriptionTier.ENTERPRISE) {
      return { allowed: true };
    }

    // Check team member limit
    if (action === 'team_member_added') {
      if (quota.teamMembers === -1) return { allowed: true };
      if (team._count.members >= quota.teamMembers) {
        return {
          allowed: false,
          reason: 'Team member limit reached',
          currentUsage: team._count.members,
          limit: quota.teamMembers,
          remaining: 0,
        };
      }
      return {
        allowed: true,
        currentUsage: team._count.members,
        limit: quota.teamMembers,
        remaining: quota.teamMembers - team._count.members,
      };
    }

    // For other actions, check monthly usage
    const currentMonth = this.getCurrentMonthRange();
    const usage = await this.getTeamUsageForPeriod(teamId, currentMonth.start, currentMonth.end);

    // Use team's custom quota if set, otherwise use tier quota
    const teamQuota = team.usageQuota || quota.specifications;

    if (action === 'spec_generated') {
      if (teamQuota === -1) return { allowed: true };
      if (usage.specifications >= teamQuota) {
        return {
          allowed: false,
          reason: 'Team monthly specification limit reached',
          currentUsage: usage.specifications,
          limit: teamQuota,
          remaining: 0,
        };
      }
      return {
        allowed: true,
        currentUsage: usage.specifications,
        limit: teamQuota,
        remaining: teamQuota - usage.specifications,
      };
    }

    return { allowed: true };
  }

  /**
   * Get user usage statistics
   */
  async getUserUsageStats(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const period = this.getPeriodRange(startDate, endDate);
    const usage = await this.getUserUsageForPeriod(userId, period.start, period.end);
    const quota = USAGE_QUOTAS[user.subscriptionTier];

    return {
      period,
      usage,
      quota,
      percentages: this.calculateUsagePercentages(usage, quota),
    };
  }

  /**
   * Get team usage statistics
   */
  async getTeamUsageStats(
    teamId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<UsageStats> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: true,
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const period = this.getPeriodRange(startDate, endDate);
    const usage = await this.getTeamUsageForPeriod(teamId, period.start, period.end);
    const quota = USAGE_QUOTAS[team.owner.subscriptionTier];

    // Add current team members to usage
    usage.teamMembers = team._count.members;

    return {
      period,
      usage,
      quota,
      percentages: this.calculateUsagePercentages(usage, quota),
    };
  }

  /**
   * Reset monthly counters
   */
  async resetMonthlyCounters(): Promise<void> {
    const currentDate = new Date();

    // Reset user counters
    await this.prisma.user.updateMany({
      where: {
        lastResetDate: {
          lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        },
      },
      data: {
        generationsCount: 0,
        lastResetDate: currentDate,
      },
    });

    // Reset team counters
    await this.prisma.team.updateMany({
      data: {
        usageCount: 0,
      },
    });

    this.logger.log('Monthly usage counters reset');
  }

  /**
   * Get usage summary for admin dashboard
   */
  async getUsageSummary(): Promise<any> {
    const currentMonth = this.getCurrentMonthRange();

    const [totalUsers, activeUsers, totalSpecs, totalGenerations] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.usageLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: currentMonth.start,
            lte: currentMonth.end,
          },
          userId: { not: null },
        },
        _count: true,
      }).then(results => results.length),
      this.prisma.usageLog.count({
        where: {
          action: 'spec_generated',
          createdAt: {
            gte: currentMonth.start,
            lte: currentMonth.end,
          },
        },
      }),
      this.prisma.usageLog.count({
        where: {
          action: { in: ['ai_generation', 'view_generated'] },
          createdAt: {
            gte: currentMonth.start,
            lte: currentMonth.end,
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalSpecifications: totalSpecs,
      totalAIGenerations: totalGenerations,
      period: currentMonth,
    };
  }

  /**
   * Clean up old usage logs
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.usageLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old usage logs`);
    return result.count;
  }

  // Private helper methods

  private async getUserUsageForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const logs = await this.prisma.usageLog.groupBy({
      by: ['action'],
      where: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        action: true,
      },
    });

    const usage = {
      specifications: 0,
      aiGenerations: 0,
      teamMembers: 0,
      storage: 0,
      apiCalls: 0,
    };

    logs.forEach(log => {
      switch (log.action) {
        case 'spec_generated':
          usage.specifications = log._count.action;
          break;
        case 'ai_generation':
        case 'view_generated':
          usage.aiGenerations += log._count.action;
          break;
        case 'api_call':
          usage.apiCalls = log._count.action;
          break;
      }
    });

    return usage;
  }

  private async getTeamUsageForPeriod(
    teamId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const logs = await this.prisma.usageLog.groupBy({
      by: ['action'],
      where: {
        teamId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        action: true,
      },
    });

    const usage = {
      specifications: 0,
      aiGenerations: 0,
      teamMembers: 0,
      storage: 0,
      apiCalls: 0,
    };

    logs.forEach(log => {
      switch (log.action) {
        case 'spec_generated':
          usage.specifications = log._count.action;
          break;
        case 'ai_generation':
        case 'view_generated':
          usage.aiGenerations += log._count.action;
          break;
        case 'api_call':
          usage.apiCalls = log._count.action;
          break;
      }
    });

    return usage;
  }

  private getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private getPeriodRange(startDate?: Date, endDate?: Date) {
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }
    return this.getCurrentMonthRange();
  }

  private calculateUsagePercentages(usage: any, quota: UsageQuota) {
    const calculate = (used: number, limit: number) => {
      if (limit === -1) return 0; // Unlimited
      return Math.round((used / limit) * 100);
    };

    return {
      specifications: calculate(usage.specifications, quota.specifications),
      aiGenerations: calculate(usage.aiGenerations, quota.aiGenerations),
      teamMembers: calculate(usage.teamMembers, quota.teamMembers),
      storage: calculate(usage.storage, quota.storage),
      apiCalls: calculate(usage.apiCalls, quota.apiCalls),
    };
  }
}

// ============================================
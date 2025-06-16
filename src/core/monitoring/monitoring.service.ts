//  Monitoring service for metrics and analytics

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database';
import {
  MetricData,
  LogContext,
  PerformanceMetric,
  BusinessMetric,
  MetricType,
} from './interfaces/monitoring.interface';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private metrics: Map<string, MetricData[]> = new Map();
  private performanceBuffer: PerformanceMetric[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  onModuleDestroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushMetrics();
  }

  /**
   * Track a counter metric
   */
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Track a gauge metric
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      tags,
      timestamp: new Date(),
    });
  }

  /**
   * Track performance metrics
   */
  async trackPerformance<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.performanceBuffer.push({
        operation,
        duration,
        success,
        metadata,
      });

      this.logger.debug(`${operation} completed in ${duration}ms`, {
        operation,
        duration,
        success,
        metadata,
      });
    }
  }

  /**
   * Track business metrics
   */
  async trackBusinessMetric(metric: BusinessMetric): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType: `metric.${metric.metric}`,
          eventData: {
            value: metric.value,
            dimensions: metric.dimensions,
            timestamp: new Date(),
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to track business metric', error);
    }
  }

  /**
   * Log with context
   */
  logWithContext(
    level: 'log' | 'error' | 'warn' | 'debug',
    message: string,
    context: LogContext,
  ): void {
    const enhancedMessage = {
      message,
      ...context,
      timestamp: new Date().toISOString(),
    };

    this.logger[level](enhancedMessage);
  }

  /**
   * Track user activity
   */
  async trackUserActivity(
    userId: string,
    action: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType: `user.${action}`,
          userId,
          eventData: {
            action,
            ...metadata,
          },
        },
      });

      this.incrementCounter('user_activity', 1, { action });
    } catch (error) {
      this.logger.error('Failed to track user activity', error);
    }
  }

  /**
   * Track team activity
   */
  async trackTeamActivity(
    teamId: string,
    action: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventType: `team.${action}`,
          teamId,
          eventData: {
            action,
            ...metadata,
          },
        },
      });

      this.incrementCounter('team_activity', 1, { action });
    } catch (error) {
      this.logger.error('Failed to track team activity', error);
    }
  }

  /**
   * Track AI generation metrics
   */
  async trackAiGeneration(
    type: string,
    duration: number,
    success: boolean,
    metadata?: {
      provider?: string;
      model?: string;
      tokens?: number;
      userId?: string;
      teamId?: string;
    },
  ): Promise<void> {
    this.incrementCounter('ai_generations', 1, {
      type,
      success: success.toString(),
      provider: metadata?.provider || 'unknown',
    });

    this.setGauge('ai_generation_duration', duration, {
      type,
      provider: metadata?.provider || 'unknown',
    });

    if (metadata?.tokens) {
      this.incrementCounter('ai_tokens_used', metadata.tokens, {
        provider: metadata.provider || 'unknown',
        model: metadata.model || 'unknown',
      });
    }

    await this.trackBusinessMetric({
      metric: 'ai_generation',
      value: duration,
      dimensions: {
        type,
        success: success.toString(),
        provider: metadata?.provider || 'unknown',
      },
    });
  }

  /**
   * Get metrics summary
   */
  async getMetricsSummary(startDate?: Date, endDate?: Date): Promise<Record<string, any>> {
    const dateFilter = {
      createdAt: {
        gte: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to last 24 hours
        lte: endDate || new Date(),
      },
    };

    const [totalEvents, eventsByType, userActivity, teamActivity] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: dateFilter }),
      this.prisma.analyticsEvent.groupBy({
        by: ['eventType'],
        where: dateFilter,
        _count: true,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          ...dateFilter,
          userId: { not: null },
          eventType: { startsWith: 'user.' },
        },
        _count: true,
      }),
      this.prisma.analyticsEvent.groupBy({
        by: ['teamId'],
        where: {
          ...dateFilter,
          teamId: { not: null },
          eventType: { startsWith: 'team.' },
        },
        _count: true,
      }),
    ]);

    return {
      period: {
        start: dateFilter.createdAt.gte,
        end: dateFilter.createdAt.lte,
      },
      totalEvents,
      eventsByType: eventsByType.reduce((acc, item) => {
        acc[item.eventType] = item._count;
        return acc;
      }, {}),
      activeUsers: userActivity.length,
      activeTeams: teamActivity.length,
      currentMetrics: Object.fromEntries(this.metrics),
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};

    // Group performance metrics by operation
    this.performanceBuffer.forEach(metric => {
      if (!report[metric.operation]) {
        report[metric.operation] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          successCount: 0,
          failureCount: 0,
        };
      }

      const op = report[metric.operation];
      op.count++;
      op.totalDuration += metric.duration;
      op.minDuration = Math.min(op.minDuration, metric.duration);
      op.maxDuration = Math.max(op.maxDuration, metric.duration);

      if (metric.success) {
        op.successCount++;
      } else {
        op.failureCount++;
      }
    });

    // Calculate averages
    Object.keys(report).forEach(operation => {
      const op = report[operation];
      op.avgDuration = op.totalDuration / op.count;
      op.successRate = (op.successCount / op.count) * 100;
    });

    return report;
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldAnalytics(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.analyticsEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old analytics events`);
    return result.count;
  }

  // Private methods

  private recordMetric(metric: MetricData): void {
    const key = this.generateMetricKey(metric.name, metric.tags);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(metric);
  }

  private generateMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;

    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');

    return `${name}{${tagString}}`;
  }

  private async flushMetrics(): Promise<void> {
    if (this.metrics.size === 0 && this.performanceBuffer.length === 0) {
      return;
    }

    try {
      // Aggregate metrics
      const aggregatedMetrics: Record<string, any> = {};

      this.metrics.forEach((values, key) => {
        if (values.length > 0) {
          aggregatedMetrics[key] = {
            count: values.length,
            sum: values.reduce((sum, v) => sum + v.value, 0),
            avg: values.reduce((sum, v) => sum + v.value, 0) / values.length,
            min: Math.min(...values.map(v => v.value)),
            max: Math.max(...values.map(v => v.value)),
            last: values[values.length - 1].value,
          };
        }
      });

      // Store aggregated metrics
      if (Object.keys(aggregatedMetrics).length > 0) {
        await this.prisma.analyticsEvent.create({
          data: {
            eventType: 'metrics.flush',
            eventData: {
              metrics: aggregatedMetrics,
              performanceBuffer: this.performanceBuffer.slice(0, 100).map(p => ({
                operation: p.operation,
                duration: p.duration,
                success: p.success,
                metadata: p.metadata || {},
              })),
            },
          },
        });
      }

      // Clear buffers
      this.metrics.clear();
      this.performanceBuffer = [];
    } catch (error) {
      this.logger.error('Failed to flush metrics', error);
    }
  }
}

// ============================================

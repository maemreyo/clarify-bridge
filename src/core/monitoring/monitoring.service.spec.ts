import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '@core/database';
import {
  MetricData,
  LogContext,
  PerformanceMetric,
  BusinessMetric,
} from './interfaces/monitoring.interface';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prismaService: jest.Mocked<PrismaService>;
  let logger: jest.Mocked<any>;

  const mockAnalyticsEvent = {
    id: 'event-123',
    eventType: 'test.event',
    userId: 'user-123',
    teamId: 'team-456',
    eventData: { test: 'data' },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        {
          provide: PrismaService,
          useValue: {
            analyticsEvent: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
    prismaService = module.get(PrismaService);
    logger = module.get(WINSTON_MODULE_PROVIDER);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have logger injected', () => {
      expect(logger).toBeDefined();
    });

    it('should have PrismaService injected', () => {
      expect(prismaService).toBeDefined();
    });

    it('should initialize with empty buffers', () => {
      expect((service as any).metricBuffer).toEqual([]);
      expect((service as any).performanceBuffer).toEqual([]);
    });
  });

  describe('recordMetric - Private Method', () => {
    it('should add metric to buffer', () => {
      // Arrange
      const metric: MetricData = {
        name: 'test_metric',
        value: 100,
        tags: { environment: 'test' },
        timestamp: new Date(),
      };

      // Act
      (service as any).recordMetric(metric);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual(metric);
    });

    it('should handle metrics without tags', () => {
      // Arrange
      const metric: MetricData = {
        name: 'simple_metric',
        value: 50,
      };

      // Act
      (service as any).recordMetric(metric);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0]).toEqual(metric);
    });

    it('should handle multiple metrics', () => {
      // Arrange
      const metrics: MetricData[] = [
        { name: 'metric1', value: 10 },
        { name: 'metric2', value: 20 },
        { name: 'metric3', value: 30 },
      ];

      // Act
      metrics.forEach(metric => (service as any).recordMetric(metric));

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer).toHaveLength(3);
      expect(buffer.map(m => m.value)).toEqual([10, 20, 30]);
    });
  });

  describe('incrementCounter', () => {
    it('should increment counter with default value', () => {
      // Arrange
      const name = 'api_requests';
      const tags = { endpoint: '/users' };

      // Act
      service.incrementCounter(name, tags);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual({
        name,
        value: 1,
        tags,
        timestamp: expect.any(Date),
      });
    });

    it('should increment counter with custom value', () => {
      // Arrange
      const name = 'batch_processed';
      const value = 50;
      const tags = { batch_type: 'specification' };

      // Act
      service.incrementCounter(name, value, tags);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0]).toEqual({
        name,
        value,
        tags,
        timestamp: expect.any(Date),
      });
    });

    it('should handle counter without tags', () => {
      // Arrange
      const name = 'simple_counter';

      // Act
      service.incrementCounter(name);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0]).toEqual({
        name,
        value: 1,
        tags: undefined,
        timestamp: expect.any(Date),
      });
    });

    it('should handle negative values', () => {
      // Arrange
      const name = 'error_counter';
      const value = -5;

      // Act
      service.incrementCounter(name, value);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0].value).toBe(-5);
    });

    it('should handle zero values', () => {
      // Arrange
      const name = 'zero_counter';
      const value = 0;

      // Act
      service.incrementCounter(name, value);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0].value).toBe(0);
    });
  });

  describe('setGauge', () => {
    it('should set gauge value with tags', () => {
      // Arrange
      const name = 'cpu_usage';
      const value = 75.5;
      const tags = { server: 'web-01' };

      // Act
      service.setGauge(name, value, tags);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0]).toEqual({
        name,
        value,
        tags,
        timestamp: expect.any(Date),
      });
    });

    it('should set gauge value without tags', () => {
      // Arrange
      const name = 'memory_usage';
      const value = 1024.5;

      // Act
      service.setGauge(name, value);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0]).toEqual({
        name,
        value,
        tags: undefined,
        timestamp: expect.any(Date),
      });
    });

    it('should handle decimal values', () => {
      // Arrange
      const name = 'response_time';
      const value = 123.456;

      // Act
      service.setGauge(name, value);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0].value).toBe(123.456);
    });

    it('should handle very large values', () => {
      // Arrange
      const name = 'disk_space';
      const value = Number.MAX_SAFE_INTEGER;

      // Act
      service.setGauge(name, value);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer[0].value).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should overwrite gauge values for same name', () => {
      // Arrange
      const name = 'active_users';

      // Act
      service.setGauge(name, 100);
      service.setGauge(name, 150);
      service.setGauge(name, 75);

      // Assert
      const buffer = (service as any).metricBuffer;
      expect(buffer).toHaveLength(3);
      expect(buffer.map(m => m.value)).toEqual([100, 150, 75]);
    });
  });

  describe('trackPerformance', () => {
    it('should track successful operation performance', async () => {
      // Arrange
      const operation = 'generateSpecification';
      const mockResult = { id: 'spec-123' };
      const asyncFn = jest.fn().mockResolvedValue(mockResult);
      const metadata = { userId: 'user-123' };

      // Act
      const result = await service.trackPerformance(operation, asyncFn, metadata);

      // Assert
      expect(result).toEqual(mockResult);
      expect(asyncFn).toHaveBeenCalled();

      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer).toHaveLength(1);
      expect(performanceBuffer[0]).toEqual({
        operation,
        duration: expect.any(Number),
        success: true,
        metadata,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        `${operation} completed in ${performanceBuffer[0].duration}ms`,
        expect.objectContaining({
          operation,
          duration: expect.any(Number),
          success: true,
          metadata,
        })
      );
    });

    it('should track failed operation performance', async () => {
      // Arrange
      const operation = 'failedOperation';
      const error = new Error('Operation failed');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const metadata = { retryAttempt: 1 };

      // Act & Assert
      await expect(service.trackPerformance(operation, asyncFn, metadata)).rejects.toThrow(error);

      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer).toHaveLength(1);
      expect(performanceBuffer[0]).toEqual({
        operation,
        duration: expect.any(Number),
        success: false,
        metadata,
      });
    });

    it('should track performance without metadata', async () => {
      // Arrange
      const operation = 'simpleOperation';
      const asyncFn = jest.fn().mockResolvedValue('success');

      // Act
      await service.trackPerformance(operation, asyncFn);

      // Assert
      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer[0]).toEqual({
        operation,
        duration: expect.any(Number),
        success: true,
        metadata: undefined,
      });
    });

    it('should measure actual duration', async () => {
      // Arrange
      const operation = 'slowOperation';
      const delay = 100;
      const asyncFn = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, delay))
      );

      // Act
      const startTime = Date.now();
      await service.trackPerformance(operation, asyncFn);
      const actualDuration = Date.now() - startTime;

      // Assert
      const performanceBuffer = (service as any).performanceBuffer;
      const trackedDuration = performanceBuffer[0].duration;

      expect(trackedDuration).toBeGreaterThanOrEqual(delay - 10); // Allow 10ms variance
      expect(trackedDuration).toBeLessThanOrEqual(actualDuration + 10);
    });

    it('should handle concurrent performance tracking', async () => {
      // Arrange
      const operations = ['op1', 'op2', 'op3'];
      const asyncFns = operations.map(op =>
        jest.fn().mockResolvedValue(`result-${op}`)
      );

      // Act
      const results = await Promise.all(
        operations.map((op, index) =>
          service.trackPerformance(op, asyncFns[index])
        )
      );

      // Assert
      expect(results).toEqual(['result-op1', 'result-op2', 'result-op3']);

      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer).toHaveLength(3);
      expect(performanceBuffer.map(p => p.operation)).toEqual(operations);
    });

    it('should handle synchronous functions wrapped in async', async () => {
      // Arrange
      const operation = 'syncOperation';
      const syncFn = jest.fn().mockReturnValue('sync result');
      const asyncWrapper = () => Promise.resolve(syncFn());

      // Act
      const result = await service.trackPerformance(operation, asyncWrapper);

      // Assert
      expect(result).toBe('sync result');
      expect(syncFn).toHaveBeenCalled();

      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer[0].success).toBe(true);
    });
  });

  describe('trackBusinessMetric', () => {
    it('should track business metric successfully', async () => {
      // Arrange
      const metric: BusinessMetric = {
        metric: 'user_signup',
        value: 1,
        dimensions: { source: 'organic', plan: 'free' },
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackBusinessMetric(metric);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'metric.user_signup',
          eventData: {
            value: 1,
            dimensions: { source: 'organic', plan: 'free' },
            timestamp: expect.any(Date),
          },
        },
      });
    });

    it('should track business metric without dimensions', async () => {
      // Arrange
      const metric: BusinessMetric = {
        metric: 'revenue',
        value: 99.99,
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackBusinessMetric(metric);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'metric.revenue',
          eventData: {
            value: 99.99,
            dimensions: undefined,
            timestamp: expect.any(Date),
          },
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const metric: BusinessMetric = {
        metric: 'error_metric',
        value: 1,
      };

      const dbError = new Error('Database connection failed');
      prismaService.analyticsEvent.create.mockRejectedValue(dbError);

      // Act
      await service.trackBusinessMetric(metric);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Failed to track business metric', dbError);
    });

    it('should handle very large metric values', async () => {
      // Arrange
      const metric: BusinessMetric = {
        metric: 'large_value',
        value: Number.MAX_SAFE_INTEGER,
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackBusinessMetric(metric);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'metric.large_value',
          eventData: {
            value: Number.MAX_SAFE_INTEGER,
            dimensions: undefined,
            timestamp: expect.any(Date),
          },
        },
      });
    });

    it('should handle negative metric values', async () => {
      // Arrange
      const metric: BusinessMetric = {
        metric: 'refund',
        value: -50.99,
        dimensions: { reason: 'customer_request' },
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackBusinessMetric(metric);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'metric.refund',
          eventData: {
            value: -50.99,
            dimensions: { reason: 'customer_request' },
            timestamp: expect.any(Date),
          },
        },
      });
    });
  });

  describe('logWithContext', () => {
    it('should log with context information', () => {
      // Arrange
      const level = 'log';
      const message = 'User action completed';
      const context: LogContext = {
        userId: 'user-123',
        teamId: 'team-456',
        requestId: 'req-789',
        action: 'create_specification',
      };

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.log).toHaveBeenCalledWith({
        message,
        userId: 'user-123',
        teamId: 'team-456',
        requestId: 'req-789',
        action: 'create_specification',
        timestamp: expect.any(String),
      });
    });

    it('should log error with context', () => {
      // Arrange
      const level = 'error';
      const message = 'Authentication failed';
      const context: LogContext = {
        userId: 'user-123',
        error: 'invalid_token',
      };

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.error).toHaveBeenCalledWith({
        message,
        userId: 'user-123',
        error: 'invalid_token',
        timestamp: expect.any(String),
      });
    });

    it('should log warning with context', () => {
      // Arrange
      const level = 'warn';
      const message = 'Rate limit approaching';
      const context: LogContext = {
        userId: 'user-123',
        currentUsage: 90,
        limit: 100,
      };

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith({
        message,
        userId: 'user-123',
        currentUsage: 90,
        limit: 100,
        timestamp: expect.any(String),
      });
    });

    it('should log debug with context', () => {
      // Arrange
      const level = 'debug';
      const message = 'Cache hit';
      const context: LogContext = {
        key: 'user:123:preferences',
        ttl: 3600,
      };

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.debug).toHaveBeenCalledWith({
        message,
        key: 'user:123:preferences',
        ttl: 3600,
        timestamp: expect.any(String),
      });
    });

    it('should handle empty context', () => {
      // Arrange
      const level = 'log';
      const message = 'Simple log message';
      const context: LogContext = {};

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.log).toHaveBeenCalledWith({
        message,
        timestamp: expect.any(String),
      });
    });

    it('should handle complex context objects', () => {
      // Arrange
      const level = 'log';
      const message = 'Complex operation';
      const context: LogContext = {
        userId: 'user-123',
        metadata: {
          nested: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
        tags: ['important', 'analytics'],
      };

      // Act
      service.logWithContext(level, message, context);

      // Assert
      expect(logger.log).toHaveBeenCalledWith({
        message,
        userId: 'user-123',
        metadata: {
          nested: {
            value: 'test',
            array: [1, 2, 3],
          },
        },
        tags: ['important', 'analytics'],
        timestamp: expect.any(String),
      });
    });
  });

  describe('trackUserActivity', () => {
    it('should track user activity successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const action = 'create_specification';
      const metadata = { specType: 'web_app', complexity: 'medium' };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackUserActivity(userId, action, metadata);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.create_specification',
          userId,
          eventData: {
            action,
            specType: 'web_app',
            complexity: 'medium',
          },
        },
      });

      // Should also increment counter
      const metricBuffer = (service as any).metricBuffer;
      expect(metricBuffer).toHaveLength(1);
      expect(metricBuffer[0]).toEqual({
        name: 'user_activity',
        value: 1,
        tags: { action },
        timestamp: expect.any(Date),
      });
    });

    it('should track user activity without metadata', async () => {
      // Arrange
      const userId = 'user-456';
      const action = 'login';

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackUserActivity(userId, action);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.login',
          userId,
          eventData: {
            action,
          },
        },
      });
    });

    it('should handle database errors in user activity tracking', async () => {
      // Arrange
      const userId = 'user-123';
      const action = 'error_action';
      const dbError = new Error('Database error');

      prismaService.analyticsEvent.create.mockRejectedValue(dbError);

      // Act
      await service.trackUserActivity(userId, action);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Failed to track user activity', dbError);

      // Counter should still be incremented even if DB fails
      const metricBuffer = (service as any).metricBuffer;
      expect(metricBuffer).toHaveLength(1);
    });

    it('should handle complex metadata in user activity', async () => {
      // Arrange
      const userId = 'user-123';
      const action = 'export_specification';
      const metadata = {
        format: 'pdf',
        pages: 25,
        sections: ['overview', 'technical', 'design'],
        exportTime: new Date().toISOString(),
        fileSize: 1024000,
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackUserActivity(userId, action, metadata);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.export_specification',
          userId,
          eventData: {
            action,
            ...metadata,
          },
        },
      });
    });
  });

  describe('trackTeamActivity', () => {
    it('should track team activity successfully', async () => {
      // Arrange
      const teamId = 'team-456';
      const action = 'add_member';
      const metadata = {
        newMemberId: 'user-789',
        role: 'developer',
        invitedBy: 'user-123',
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackTeamActivity(teamId, action, metadata);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'team.add_member',
          teamId,
          eventData: {
            action,
            newMemberId: 'user-789',
            role: 'developer',
            invitedBy: 'user-123',
          },
        },
      });

      // Should also increment counter
      const metricBuffer = (service as any).metricBuffer;
      expect(metricBuffer).toHaveLength(1);
      expect(metricBuffer[0]).toEqual({
        name: 'team_activity',
        value: 1,
        tags: { action },
        timestamp: expect.any(Date),
      });
    });

    it('should track team activity without metadata', async () => {
      // Arrange
      const teamId = 'team-456';
      const action = 'created';

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackTeamActivity(teamId, action);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'team.created',
          teamId,
          eventData: {
            action,
          },
        },
      });
    });

    it('should handle database errors in team activity tracking', async () => {
      // Arrange
      const teamId = 'team-456';
      const action = 'error_action';
      const dbError = new Error('Database connection lost');

      prismaService.analyticsEvent.create.mockRejectedValue(dbError);

      // Act
      await service.trackTeamActivity(teamId, action);

      // Assert
      expect(logger.error).toHaveBeenCalledWith('Failed to track team activity', dbError);
    });
  });

  describe('Buffer Management and Memory', () => {
    it('should handle large metric buffers efficiently', () => {
      // Arrange
      const largeNumber = 1000;

      // Act
      for (let i = 0; i < largeNumber; i++) {
        service.incrementCounter(`metric_${i}`, 1, { index: i.toString() });
      }

      // Assert
      const metricBuffer = (service as any).metricBuffer;
      expect(metricBuffer).toHaveLength(largeNumber);
      expect(metricBuffer[0].name).toBe('metric_0');
      expect(metricBuffer[999].name).toBe('metric_999');
    });

    it('should handle large performance buffers efficiently', async () => {
      // Arrange
      const operations = Array.from({ length: 100 }, (_, i) => `op_${i}`);
      const asyncFns = operations.map(() => jest.fn().mockResolvedValue('success'));

      // Act
      await Promise.all(
        operations.map((op, index) =>
          service.trackPerformance(op, asyncFns[index])
        )
      );

      // Assert
      const performanceBuffer = (service as any).performanceBuffer;
      expect(performanceBuffer).toHaveLength(100);
    });

    it('should not leak memory with repeated operations', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Perform many operations
      for (let i = 0; i < 100; i++) {
        service.incrementCounter('test_counter');
        service.setGauge('test_gauge', Math.random() * 100);
        await service.trackPerformance('test_op', async () => 'result');
        service.logWithContext('log', 'test message', { iteration: i });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be reasonable (less than 5MB)
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid log levels gracefully', () => {
      // Arrange
      const invalidLevel = 'invalid' as any;
      const message = 'Test message';
      const context = { test: true };

      // Act & Assert - Should not throw
      expect(() => {
        service.logWithContext(invalidLevel, message, context);
      }).not.toThrow();
    });

    it('should handle null/undefined values in contexts', () => {
      // Arrange
      const context: LogContext = {
        userId: null as any,
        teamId: undefined,
        validValue: 'test',
      };

      // Act
      service.logWithContext('log', 'Test message', context);

      // Assert
      expect(logger.log).toHaveBeenCalledWith({
        message: 'Test message',
        userId: null,
        teamId: undefined,
        validValue: 'test',
        timestamp: expect.any(String),
      });
    });

    it('should handle empty strings and special characters', async () => {
      // Arrange
      const userId = '';
      const action = 'special!@#$%^&*()';
      const metadata = {
        unicode: '🚀✨💯',
        empty: '',
        special: '`~!@#$%^&*()_+-=[]{}|;:,.<>?',
      };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackUserActivity(userId, action, metadata);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: `user.${action}`,
          userId: '',
          eventData: {
            action,
            ...metadata,
          },
        },
      });
    });

    it('should handle concurrent database operations', async () => {
      // Arrange
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.trackUserActivity(`user-${i}`, 'concurrent_test')
      );

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await Promise.all(promises);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledTimes(10);
    });

    it('should handle very long strings in metadata', async () => {
      // Arrange
      const userId = 'user-123';
      const action = 'long_data_test';
      const longString = 'A'.repeat(10000); // 10KB string
      const metadata = { longValue: longString };

      prismaService.analyticsEvent.create.mockResolvedValue(mockAnalyticsEvent);

      // Act
      await service.trackUserActivity(userId, action, metadata);

      // Assert
      expect(prismaService.analyticsEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'user.long_data_test',
          userId,
          eventData: {
            action,
            longValue: longString,
          },
        },
      });
    });
  });
});
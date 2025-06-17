import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HttpHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { LlmHealthIndicator } from './indicators/llm.health';
import { VectorDbHealthIndicator } from './indicators/vector-db.health';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let httpHealthIndicator: jest.Mocked<HttpHealthIndicator>;
  let memoryHealthIndicator: jest.Mocked<MemoryHealthIndicator>;
  let diskHealthIndicator: jest.Mocked<DiskHealthIndicator>;
  let databaseHealthIndicator: jest.Mocked<DatabaseHealthIndicator>;
  let redisHealthIndicator: jest.Mocked<RedisHealthIndicator>;
  let llmHealthIndicator: jest.Mocked<LlmHealthIndicator>;
  let vectorDbHealthIndicator: jest.Mocked<VectorDbHealthIndicator>;

  const mockHealthyResult: HealthCheckResult = {
    status: 'ok',
    info: {
      database: { status: 'up' },
      redis: { status: 'up' },
    },
    error: {},
    details: {
      database: { status: 'up' },
      redis: { status: 'up' },
    },
  };

  const mockUnhealthyResult: HealthCheckResult = {
    status: 'error',
    info: {
      redis: { status: 'up' },
    },
    error: {
      database: { status: 'down', message: 'Connection failed' },
    },
    details: {
      database: { status: 'down', message: 'Connection failed' },
      redis: { status: 'up' },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: HttpHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
        {
          provide: DiskHealthIndicator,
          useValue: {
            checkStorage: jest.fn(),
          },
        },
        {
          provide: DatabaseHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: RedisHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: LlmHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
        {
          provide: VectorDbHealthIndicator,
          useValue: {
            isHealthy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get(HealthCheckService);
    httpHealthIndicator = module.get(HttpHealthIndicator);
    memoryHealthIndicator = module.get(MemoryHealthIndicator);
    diskHealthIndicator = module.get(DiskHealthIndicator);
    databaseHealthIndicator = module.get(DatabaseHealthIndicator);
    redisHealthIndicator = module.get(RedisHealthIndicator);
    llmHealthIndicator = module.get(LlmHealthIndicator);
    vectorDbHealthIndicator = module.get(VectorDbHealthIndicator);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have all required dependencies injected', () => {
      expect(healthCheckService).toBeDefined();
      expect(httpHealthIndicator).toBeDefined();
      expect(memoryHealthIndicator).toBeDefined();
      expect(diskHealthIndicator).toBeDefined();
      expect(databaseHealthIndicator).toBeDefined();
      expect(redisHealthIndicator).toBeDefined();
      expect(llmHealthIndicator).toBeDefined();
      expect(vectorDbHealthIndicator).toBeDefined();
    });
  });

  describe('check - Basic Health Check', () => {
    it('should return healthy status when all services are up', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthyResult);

      databaseHealthIndicator.isHealthy.mockResolvedValue({
        database: { status: 'up', responseTime: '10ms' },
      });

      redisHealthIndicator.isHealthy.mockResolvedValue({
        redis: { status: 'up', responseTime: '5ms' },
      });

      memoryHealthIndicator.checkHeap.mockResolvedValue({
        memory_heap: { status: 'up', used: '150MB' },
      });

      memoryHealthIndicator.checkRSS.mockResolvedValue({
        memory_rss: { status: 'up', used: '250MB' },
      });

      // Act
      const result = await controller.check();

      // Assert
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // redis check
        expect.any(Function), // memory heap check
        expect.any(Function), // memory RSS check
      ]);
      expect(result).toEqual(mockHealthyResult);
    });

    it('should handle health check errors', async () => {
      // Arrange
      const healthCheckError = new HealthCheckError(
        'Health check failed',
        mockUnhealthyResult
      );
      healthCheckService.check.mockRejectedValue(healthCheckError);

      // Act & Assert
      await expect(controller.check()).rejects.toThrow(HealthCheckError);
    });

    it('should call database health indicator correctly', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        // Execute the first check function (database)
        await checks[0]();
        return mockHealthyResult;
      });

      // Act
      await controller.check();

      // Assert
      expect(databaseHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
    });

    it('should call redis health indicator correctly', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        // Execute the second check function (redis)
        await checks[1]();
        return mockHealthyResult;
      });

      // Act
      await controller.check();

      // Assert
      expect(redisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
    });

    it('should call memory health indicators with correct thresholds', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        // Execute memory check functions
        await checks[2]();
        await checks[3]();
        return mockHealthyResult;
      });

      // Act
      await controller.check();

      // Assert
      expect(memoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        200 * 1024 * 1024
      );
      expect(memoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        300 * 1024 * 1024
      );
    });
  });

  describe('liveness - Kubernetes Liveness Probe', () => {
    it('should return ok status with timestamp', async () => {
      // Arrange
      const beforeCall = Date.now();

      // Act
      const result = await controller.liveness();

      // Assert
      const afterCall = Date.now();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();

      const timestamp = new Date(result.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(timestamp).toBeLessThanOrEqual(afterCall);
    });

    it('should always return success (no dependencies)', async () => {
      // Act
      const result1 = await controller.liveness();
      const result2 = await controller.liveness();

      // Assert
      expect(result1.status).toBe('ok');
      expect(result2.status).toBe('ok');
      expect(result1.timestamp).not.toBe(result2.timestamp);
    });
  });

  describe('readiness - Kubernetes Readiness Probe', () => {
    it('should return ready status when critical services are up', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthyResult);

      databaseHealthIndicator.isHealthy.mockResolvedValue({
        database: { status: 'up' },
      });

      redisHealthIndicator.isHealthy.mockResolvedValue({
        redis: { status: 'up' },
      });

      // Act
      const result = await controller.readiness();

      // Assert
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // redis check
      ]);
      expect(result).toEqual(mockHealthyResult);
    });

    it('should fail when critical services are down', async () => {
      // Arrange
      const readinessError = new HealthCheckError(
        'Service not ready',
        mockUnhealthyResult
      );
      healthCheckService.check.mockRejectedValue(readinessError);

      // Act & Assert
      await expect(controller.readiness()).rejects.toThrow(HealthCheckError);
    });

    it('should only check critical services', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        expect(checks).toHaveLength(2); // Only database and redis
        await Promise.all(checks.map(check => check()));
        return mockHealthyResult;
      });

      // Act
      await controller.readiness();

      // Assert
      expect(databaseHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
      expect(redisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
      expect(llmHealthIndicator.isHealthy).not.toHaveBeenCalled();
      expect(vectorDbHealthIndicator.isHealthy).not.toHaveBeenCalled();
    });
  });

  describe('detailed - Comprehensive Health Check', () => {
    beforeEach(() => {
      // Setup all health indicators to return healthy by default
      databaseHealthIndicator.isHealthy.mockResolvedValue({
        database: { status: 'up' },
      });
      redisHealthIndicator.isHealthy.mockResolvedValue({
        redis: { status: 'up' },
      });
      llmHealthIndicator.isHealthy.mockResolvedValue({
        llm: { status: 'up' },
      });
      vectorDbHealthIndicator.isHealthy.mockResolvedValue({
        vector_db: { status: 'up' },
      });
      memoryHealthIndicator.checkHeap.mockResolvedValue({
        memory_heap: { status: 'up' },
      });
      memoryHealthIndicator.checkRSS.mockResolvedValue({
        memory_rss: { status: 'up' },
      });
      diskHealthIndicator.checkStorage.mockResolvedValue({
        disk_storage: { status: 'up' },
      });
      httpHealthIndicator.pingCheck.mockResolvedValue({
        google: { status: 'up' },
      });
    });

    it('should perform comprehensive health check', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthyResult);

      // Act
      const result = await controller.detailed();

      // Assert
      expect(healthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database
        expect.any(Function), // redis
        expect.any(Function), // llm
        expect.any(Function), // vector_db
        expect.any(Function), // memory_heap
        expect.any(Function), // memory_rss
        expect.any(Function), // disk_storage
        expect.any(Function), // google ping
      ]);
      expect(result).toEqual(mockHealthyResult);
    });

    it('should check all health indicators', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        await Promise.all(checks.map(check => check()));
        return mockHealthyResult;
      });

      // Act
      await controller.detailed();

      // Assert
      expect(databaseHealthIndicator.isHealthy).toHaveBeenCalledWith('database');
      expect(redisHealthIndicator.isHealthy).toHaveBeenCalledWith('redis');
      expect(llmHealthIndicator.isHealthy).toHaveBeenCalledWith('llm');
      expect(vectorDbHealthIndicator.isHealthy).toHaveBeenCalledWith('vector_db');
    });

    it('should check system resources', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        // Execute memory and disk checks
        await checks[4](); // memory_heap
        await checks[5](); // memory_rss
        await checks[6](); // disk_storage
        return mockHealthyResult;
      });

      // Act
      await controller.detailed();

      // Assert
      expect(memoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        200 * 1024 * 1024
      );
      expect(memoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        300 * 1024 * 1024
      );
      expect(diskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'disk_storage',
        expect.objectContaining({
          thresholdPercent: 0.9,
        })
      );
    });

    it('should check external dependencies', async () => {
      // Arrange
      healthCheckService.check.mockImplementation(async (checks) => {
        await checks[7](); // google ping check
        return mockHealthyResult;
      });

      // Act
      await controller.detailed();

      // Assert
      expect(httpHealthIndicator.pingCheck).toHaveBeenCalledWith(
        'google',
        'https://google.com'
      );
    });

    it('should handle disk path based on platform', async () => {
      // Arrange
      const originalPlatform = process.platform;

      healthCheckService.check.mockImplementation(async (checks) => {
        await checks[6](); // disk check
        return mockHealthyResult;
      });

      // Test Windows path
      Object.defineProperty(process, 'platform', { value: 'win32' });
      await controller.detailed();

      expect(diskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'disk_storage',
        expect.objectContaining({
          path: 'C:\\',
        })
      );

      // Test Unix path
      Object.defineProperty(process, 'platform', { value: 'linux' });
      await controller.detailed();

      expect(diskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        'disk_storage',
        expect.objectContaining({
          path: '/',
        })
      );

      // Restore original platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle partial service failures', async () => {
      // Arrange
      const partialFailureResult: HealthCheckResult = {
        status: 'error',
        info: {
          database: { status: 'up' },
          redis: { status: 'up' },
        },
        error: {
          llm: { status: 'down', message: 'AI service unavailable' },
        },
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          llm: { status: 'down', message: 'AI service unavailable' },
        },
      };

      llmHealthIndicator.isHealthy.mockRejectedValue(
        new HealthCheckError('LLM check failed', {
          llm: { status: 'down', message: 'AI service unavailable' },
        })
      );

      healthCheckService.check.mockResolvedValue(partialFailureResult);

      // Act
      const result = await controller.detailed();

      // Assert
      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('llm');
    });
  });

  describe('metrics - System Metrics', () => {
    it('should return comprehensive system metrics', async () => {
      // Arrange
      const mockMemoryUsage = {
        rss: 50331648,
        heapTotal: 20971520,
        heapUsed: 15728640,
        external: 1048576,
        arrayBuffers: 262144,
      };

      const mockCpuUsage = {
        user: 1000000,
        system: 500000,
      };

      jest.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage);
      jest.spyOn(process, 'uptime').mockReturnValue(3661); // 1 hour, 1 minute, 1 second
      jest.spyOn(process, 'cpuUsage').mockReturnValue(mockCpuUsage);

      const beforeCall = Date.now();

      // Act
      const result = await controller.metrics();

      // Assert
      const afterCall = Date.now();

      expect(result).toEqual({
        uptime: {
          seconds: 3661,
          formatted: '0d 1h 1m 1s',
        },
        memory: mockMemoryUsage,
        cpu: mockCpuUsage,
        node: {
          version: process.version,
          env: process.env.NODE_ENV,
        },
        timestamp: expect.any(String),
      });

      const timestamp = new Date(result.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(timestamp).toBeLessThanOrEqual(afterCall);
    });

    it('should format uptime correctly for various durations', async () => {
      // Test different uptime scenarios
      const testCases = [
        { seconds: 61, expected: '0d 0h 1m 1s' },
        { seconds: 3661, expected: '0d 1h 1m 1s' },
        { seconds: 90061, expected: '1d 1h 1m 1s' },
        { seconds: 86400, expected: '1d 0h 0m 0s' },
        { seconds: 0, expected: '0d 0h 0m 0s' },
      ];

      for (const { seconds, expected } of testCases) {
        jest.spyOn(process, 'uptime').mockReturnValue(seconds);

        const result = await controller.metrics();

        expect(result.uptime.formatted).toBe(expected);
      }
    });

    it('should include Node.js environment information', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      // Act
      const result = await controller.metrics();

      // Assert
      expect(result.node.version).toBe(process.version);
      expect(result.node.env).toBe('test');

      // Restore
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle missing NODE_ENV gracefully', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;

      // Act
      const result = await controller.metrics();

      // Assert
      expect(result.node.env).toBeUndefined();

      // Restore
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('formatUptime - Private Method Testing', () => {
    it('should format uptime correctly', () => {
      // Access private method through controller instance
      const formatUptime = (controller as any).formatUptime;

      expect(formatUptime(0)).toBe('0d 0h 0m 0s');
      expect(formatUptime(61)).toBe('0d 0h 1m 1s');
      expect(formatUptime(3661)).toBe('0d 1h 1m 1s');
      expect(formatUptime(90061)).toBe('1d 1h 1m 1s');
      expect(formatUptime(172861)).toBe('2d 0h 1m 1s');
    });

    it('should handle edge cases', () => {
      const formatUptime = (controller as any).formatUptime;

      expect(formatUptime(86400)).toBe('1d 0h 0m 0s'); // Exactly 1 day
      expect(formatUptime(3600)).toBe('0d 1h 0m 0s');  // Exactly 1 hour
      expect(formatUptime(60)).toBe('0d 0h 1m 0s');    // Exactly 1 minute
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle health service initialization errors', async () => {
      // Arrange
      const initError = new Error('Health service not initialized');
      healthCheckService.check.mockRejectedValue(initError);

      // Act & Assert
      await expect(controller.check()).rejects.toThrow('Health service not initialized');
    });

    it('should handle individual indicator failures gracefully', async () => {
      // Arrange
      const indicatorError = new Error('Database connection timeout');
      databaseHealthIndicator.isHealthy.mockRejectedValue(indicatorError);

      healthCheckService.check.mockImplementation(async (checks) => {
        try {
          await checks[0](); // This should throw
        } catch (error) {
          // Health service should handle the error and continue
        }
        return mockUnhealthyResult;
      });

      // Act
      const result = await controller.check();

      // Assert
      expect(result).toEqual(mockUnhealthyResult);
    });

    it('should handle concurrent health checks', async () => {
      // Arrange
      healthCheckService.check.mockResolvedValue(mockHealthyResult);

      // Act
      const promises = [
        controller.check(),
        controller.readiness(),
        controller.detailed(),
        controller.liveness(),
        controller.metrics(),
      ];

      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      expect(results[3]).toHaveProperty('status', 'ok'); // liveness
      expect(results[4]).toHaveProperty('uptime'); // metrics
    });

    it('should handle memory usage retrieval errors', async () => {
      // Arrange
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory stats unavailable');
      });

      // Act & Assert
      await expect(controller.metrics()).rejects.toThrow('Memory stats unavailable');
    });

    it('should handle timeout scenarios in health checks', async () => {
      // Arrange
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), 100);
      });

      healthCheckService.check.mockReturnValue(timeoutPromise as any);

      // Act & Assert
      await expect(controller.check()).rejects.toThrow('Health check timeout');
    }, 1000);
  });

  describe('Integration Scenarios', () => {
    it('should handle all services healthy scenario', async () => {
      // Arrange
      const allHealthyResult: HealthCheckResult = {
        status: 'ok',
        info: {
          database: { status: 'up', responseTime: '10ms' },
          redis: { status: 'up', responseTime: '5ms' },
          llm: { status: 'up', provider: 'openai' },
          vector_db: { status: 'up', provider: 'pinecone' },
          memory_heap: { status: 'up', used: '150MB' },
          memory_rss: { status: 'up', used: '250MB' },
          disk_storage: { status: 'up', used: '60%' },
          google: { status: 'up', responseTime: '50ms' },
        },
        error: {},
        details: {},
      };

      healthCheckService.check.mockResolvedValue(allHealthyResult);

      // Act
      const result = await controller.detailed();

      // Assert
      expect(result.status).toBe('ok');
      expect(Object.keys(result.info)).toHaveLength(8);
    });

    it('should handle cascading failures scenario', async () => {
      // Arrange
      const cascadingFailureResult: HealthCheckResult = {
        status: 'error',
        info: {
          memory_heap: { status: 'up' },
        },
        error: {
          database: { status: 'down', message: 'Connection refused' },
          redis: { status: 'down', message: 'Redis unavailable' },
          llm: { status: 'down', message: 'Dependent on database' },
        },
        details: {},
      };

      healthCheckService.check.mockResolvedValue(cascadingFailureResult);

      // Act
      const result = await controller.detailed();

      // Assert
      expect(result.status).toBe('error');
      expect(Object.keys(result.error)).toHaveLength(3);
    });
  });
});
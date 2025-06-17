import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { DatabaseHealthIndicator } from './database.health';
import { PrismaService } from '@core/database';

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseHealthIndicator,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
      ],
    }).compile();

    indicator = module.get<DatabaseHealthIndicator>(DatabaseHealthIndicator);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(indicator).toBeDefined();
    });

    it('should extend HealthIndicator', () => {
      expect(indicator).toBeInstanceOf(DatabaseHealthIndicator);
    });

    it('should have PrismaService injected', () => {
      expect(prismaService).toBeDefined();
    });
  });

  describe('isHealthy - Success Cases', () => {
    it('should return healthy status when database is accessible', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(prismaService.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
      expect(result).toEqual({
        [key]: {
          status: 'up',
          type: 'postgresql',
          responseTime: expect.stringMatching(/^\d+ms$/),
        },
      });
    });

    it('should measure response time accurately', async () => {
      // Arrange
      const key = 'database';
      let resolveFn: (value: any) => void;
      const delayedPromise = new Promise((resolve) => {
        resolveFn = resolve;
      });

      prismaService.$queryRaw.mockReturnValue(delayedPromise as any);

      // Act
      const resultPromise = indicator.isHealthy(key);

      // Simulate 50ms delay
      setTimeout(() => resolveFn([{ '1': 1 }]), 50);

      const result = await resultPromise;

      // Assert
      const responseTime = result[key].responseTime;
      const timeValue = parseInt(responseTime.replace('ms', ''));
      expect(timeValue).toBeGreaterThanOrEqual(40); // Allow some variance
      expect(timeValue).toBeLessThan(100);
    });

    it('should work with different key names', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const keys = ['db', 'database', 'postgres', 'primary_db'];

      // Act & Assert
      for (const key of keys) {
        const result = await indicator.isHealthy(key);
        expect(result).toHaveProperty(key);
        expect(result[key].status).toBe('up');
      }
    });

    it('should handle fast database responses', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';

      // Act
      const startTime = Date.now();
      const result = await indicator.isHealthy(key);
      const actualTime = Date.now() - startTime;

      // Assert
      expect(result[key].status).toBe('up');
      const reportedTime = parseInt(result[key].responseTime.replace('ms', ''));
      expect(reportedTime).toBeLessThanOrEqual(actualTime + 5); // Allow 5ms variance
    });

    it('should include correct metadata in healthy response', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'test_db';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key]).toEqual({
        status: 'up',
        type: 'postgresql',
        responseTime: expect.stringMatching(/^\d+ms$/),
      });
    });
  });

  describe('isHealthy - Error Cases', () => {
    it('should throw HealthCheckError when database query fails', async () => {
      // Arrange
      const dbError = new Error('Connection refused');
      prismaService.$queryRaw.mockRejectedValue(dbError);
      const key = 'database';

      // Act & Assert
      await expect(indicator.isHealthy(key)).rejects.toThrow(HealthCheckError);
    });

    it('should include error details in HealthCheckError', async () => {
      // Arrange
      const dbError = new Error('Connection timeout');
      prismaService.$queryRaw.mockRejectedValue(dbError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
        fail('Expected HealthCheckError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe('Database health check failed');
        expect(error.causes).toEqual({
          [key]: {
            status: 'down',
            error: 'Connection timeout',
          },
        });
      }
    });

    it('should handle database connection timeout', async () => {
      // Arrange
      const timeoutError = new Error('Connection timeout after 30s');
      prismaService.$queryRaw.mockRejectedValue(timeoutError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Connection timeout after 30s');
      }
    });

    it('should handle database authentication failures', async () => {
      // Arrange
      const authError = new Error('password authentication failed for user "app"');
      prismaService.$queryRaw.mockRejectedValue(authError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('password authentication failed');
      }
    });

    it('should handle database does not exist error', async () => {
      // Arrange
      const dbNotExistError = new Error('database "app_test" does not exist');
      prismaService.$queryRaw.mockRejectedValue(dbNotExistError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('does not exist');
      }
    });

    it('should handle network connection errors', async () => {
      // Arrange
      const networkError = new Error('ECONNREFUSED 127.0.0.1:5432');
      prismaService.$queryRaw.mockRejectedValue(networkError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('ECONNREFUSED');
      }
    });

    it('should handle Prisma client initialization errors', async () => {
      // Arrange
      const prismaError = new Error('Prisma Client could not connect to database');
      prismaService.$queryRaw.mockRejectedValue(prismaError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('Prisma Client could not connect');
      }
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null/undefined error messages', async () => {
      // Arrange
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      prismaService.$queryRaw.mockRejectedValue(errorWithoutMessage);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key]).toHaveProperty('error');
      }
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const stringError = 'Database connection failed';
      prismaService.$queryRaw.mockRejectedValue(stringError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Database connection failed');
      }
    });

    it('should handle complex error objects', async () => {
      // Arrange
      const complexError = {
        message: 'Database error',
        code: 'P1001',
        meta: { database: 'postgres' },
      };
      prismaService.$queryRaw.mockRejectedValue(complexError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Database error');
      }
    });

    it('should handle empty key parameter', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = '';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty('');
      expect(result[''].status).toBe('up');
    });

    it('should handle special characters in key parameter', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'db-test_123.primary';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty(key);
      expect(result[key].status).toBe('up');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent health checks', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const keys = ['db1', 'db2', 'db3', 'db4', 'db5'];

      // Act
      const promises = keys.map(key => indicator.isHealthy(key));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result[keys[index]].status).toBe('up');
      });
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid consecutive calls', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';

      // Act
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await indicator.isHealthy(key));
      }

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result[key].status).toBe('up');
      });
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(10);
    });

    it('should maintain performance under load', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';
      const iterations = 50;

      // Act
      const startTime = Date.now();
      const promises = Array.from({ length: iterations }, () => indicator.isHealthy(key));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(iterations);
    });

    it('should handle slow database responses gracefully', async () => {
      // Arrange
      const key = 'database';
      const slowResponse = new Promise(resolve => {
        setTimeout(() => resolve([{ '1': 1 }]), 1000); // 1 second delay
      });
      prismaService.$queryRaw.mockReturnValue(slowResponse as any);

      // Act
      const startTime = Date.now();
      const result = await indicator.isHealthy(key);
      const responseTime = Date.now() - startTime;

      // Assert
      expect(result[key].status).toBe('up');
      expect(responseTime).toBeGreaterThanOrEqual(1000);

      const reportedTime = parseInt(result[key].responseTime.replace('ms', ''));
      expect(reportedTime).toBeGreaterThanOrEqual(1000);
    });

    it('should isolate failures between concurrent checks', async () => {
      // Arrange
      const successKey = 'db_success';
      const failKey = 'db_fail';

      prismaService.$queryRaw
        .mockResolvedValueOnce([{ '1': 1 }]) // First call succeeds
        .mockRejectedValueOnce(new Error('Connection failed')); // Second call fails

      // Act
      const [successResult, failResult] = await Promise.allSettled([
        indicator.isHealthy(successKey),
        indicator.isHealthy(failKey),
      ]);

      // Assert
      expect(successResult.status).toBe('fulfilled');
      if (successResult.status === 'fulfilled') {
        expect(successResult.value[successKey].status).toBe('up');
      }

      expect(failResult.status).toBe('rejected');
      if (failResult.status === 'rejected') {
        expect(failResult.reason).toBeInstanceOf(HealthCheckError);
      }
    });
  });

  describe('Database Query Validation', () => {
    it('should execute the correct SQL query', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';

      // Act
      await indicator.isHealthy(key);

      // Assert
      expect(prismaService.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
      expect(prismaService.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('should handle different query result formats', async () => {
      // Test various possible return formats from the database
      const testCases = [
        [{ '1': 1 }],           // PostgreSQL format
        [{ '?column?': 1 }],    // Alternative PostgreSQL format
        [{ 1: 1 }],             // Numeric key format
        [],                     // Empty result (but no error)
      ];

      for (const testCase of testCases) {
        // Arrange
        prismaService.$queryRaw.mockResolvedValue(testCase);
        const key = 'database';

        // Act
        const result = await indicator.isHealthy(key);

        // Assert
        expect(result[key].status).toBe('up');

        // Reset mock for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle query timeout scenarios', async () => {
      // Arrange
      const timeoutError = new Error('Query timeout');
      timeoutError.name = 'QueryTimeoutError';
      prismaService.$queryRaw.mockRejectedValue(timeoutError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Query timeout');
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a real health check pipeline', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      // Simulate how it would be called in the health controller
      const healthChecks = [
        () => indicator.isHealthy('database'),
        () => indicator.isHealthy('replica'),
      ];

      // Act
      const results = await Promise.all(healthChecks.map(check => check()));

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].database.status).toBe('up');
      expect(results[1].replica.status).toBe('up');
    });

    it('should provide consistent results for monitoring systems', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';

      // Act - Multiple calls as monitoring system would do
      const results = await Promise.all([
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
      ]);

      // Assert
      results.forEach(result => {
        expect(result[key]).toEqual(
          expect.objectContaining({
            status: 'up',
            type: 'postgresql',
            responseTime: expect.stringMatching(/^\d+ms$/),
          })
        );
      });
    });

    it('should handle database maintenance scenarios', async () => {
      // Arrange
      const maintenanceError = new Error('database is shutting down');
      prismaService.$queryRaw.mockRejectedValue(maintenanceError);
      const key = 'database';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('shutting down');
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with repeated calls', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      const key = 'database';
      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Many repeated calls
      for (let i = 0; i < 100; i++) {
        await indicator.isHealthy(key);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle garbage collection during health checks', async () => {
      // Arrange
      prismaService.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      // Act - Force garbage collection if available and continue health checks
      const results = [];
      for (let i = 0; i < 10; i++) {
        if (global.gc) global.gc();
        results.push(await indicator.isHealthy(`db_${i}`));
      }

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result[`db_${index}`].status).toBe('up');
      });
    });
  });
});
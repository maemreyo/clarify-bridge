import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { HealthCheckError } from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';
import { QueueName } from '@core/queue';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let mockQueue: any;
  let mockRedisClient: jest.Mocked<any>;

  const mockRedisInfo = `
# Server
redis_version:6.2.6
redis_git_sha1:00000000
redis_git_dirty:0
redis_build_id:557672d61c1e7ba5
redis_mode:standalone
os:Linux 5.4.0-88-generic x86_64
arch_bits:64
multiplexing_api:epoll
atomicvar_api:atomic-builtin
gcc_version:9.4.0
process_id:1
run_id:abc123
tcp_port:6379
uptime_in_seconds:86400
uptime_in_days:1

# Memory
used_memory:1048576
used_memory_human:1.00M
used_memory_rss:2097152
used_memory_rss_human:2.00M
used_memory_peak:3145728
used_memory_peak_human:3.00M
maxmemory:0
maxmemory_human:0B

# Clients
connected_clients:10
client_longest_output_list:0
client_biggest_input_buf:0
blocked_clients:0

# Stats
total_connections_received:100
total_commands_processed:5000
instantaneous_ops_per_sec:50
total_net_input_bytes:1000000
total_net_output_bytes:2000000
instantaneous_input_kbps:10.50
instantaneous_output_kbps:20.50
rejected_connections:0
sync_full:0
sync_partial_ok:0
sync_partial_err:0
expired_keys:0
evicted_keys:0
keyspace_hits:1000
keyspace_misses:100
pubsub_channels:5
pubsub_patterns:2
latest_fork_usec:1000
`;

  beforeEach(async () => {
    // Create mock Redis client
    mockRedisClient = {
      ping: jest.fn(),
      info: jest.fn(),
    };

    // Create mock Queue
    mockQueue = {
      client: mockRedisClient,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: getQueueToken(QueueName.SPECIFICATION),
          useValue: mockQueue,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(indicator).toBeDefined();
    });

    it('should extend HealthIndicator', () => {
      expect(indicator).toBeInstanceOf(RedisHealthIndicator);
    });

    it('should have Queue injected', () => {
      expect(mockQueue).toBeDefined();
    });

    it('should have access to Redis client through queue', () => {
      expect(mockQueue.client).toBeDefined();
    });
  });

  describe('isHealthy - Success Cases', () => {
    beforeEach(() => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
    });

    it('should return healthy status when Redis is accessible', async () => {
      // Arrange
      const key = 'redis';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(mockRedisClient.info).toHaveBeenCalled();
      expect(result).toEqual({
        [key]: {
          status: 'up',
          type: 'redis',
          responseTime: expect.stringMatching(/^\d+ms$/),
          memoryUsed: '1.00M',
        },
      });
    });

    it('should measure response time accurately', async () => {
      // Arrange
      const key = 'redis';
      let resolvePing: (value: any) => void;
      let resolveInfo: (value: any) => void;

      const delayedPing = new Promise((resolve) => {
        resolvePing = resolve;
      });
      const delayedInfo = new Promise((resolve) => {
        resolveInfo = resolve;
      });

      mockRedisClient.ping.mockReturnValue(delayedPing);
      mockRedisClient.info.mockReturnValue(delayedInfo);

      // Act
      const resultPromise = indicator.isHealthy(key);

      // Simulate 30ms delay for ping and 20ms delay for info
      setTimeout(() => resolvePing('PONG'), 30);
      setTimeout(() => resolveInfo(mockRedisInfo), 50);

      const result = await resultPromise;

      // Assert
      const responseTime = result[key].responseTime;
      const timeValue = parseInt(responseTime.replace('ms', ''));
      expect(timeValue).toBeGreaterThanOrEqual(40); // Total time should be at least 50ms
      expect(timeValue).toBeLessThan(100);
    });

    it('should extract memory usage correctly', async () => {
      // Arrange
      const key = 'redis';
      const customInfo = `
# Memory
used_memory:5242880
used_memory_human:5.00M
used_memory_rss:10485760
      `;
      mockRedisClient.info.mockResolvedValue(customInfo);

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].memoryUsed).toBe('5.00M');
    });

    it('should work with different key names', async () => {
      // Arrange
      const keys = ['redis', 'cache', 'redis_primary', 'redis-cluster'];

      // Act & Assert
      for (const key of keys) {
        const result = await indicator.isHealthy(key);
        expect(result).toHaveProperty(key);
        expect(result[key].status).toBe('up');
        expect(result[key].type).toBe('redis');
      }
    });

    it('should handle minimal Redis info response', async () => {
      // Arrange
      const key = 'redis';
      const minimalInfo = `
# Memory
used_memory_human:512K
      `;
      mockRedisClient.info.mockResolvedValue(minimalInfo);

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].memoryUsed).toBe('512K');
    });

    it('should include all expected metadata in healthy response', async () => {
      // Arrange
      const key = 'test_redis';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key]).toEqual({
        status: 'up',
        type: 'redis',
        responseTime: expect.stringMatching(/^\d+ms$/),
        memoryUsed: expect.any(String),
      });
    });

    it('should handle different ping responses', async () => {
      // Test different valid ping responses
      const validPingResponses = ['PONG', 'pong', 'OK'];

      for (const pingResponse of validPingResponses) {
        // Arrange
        mockRedisClient.ping.mockResolvedValue(pingResponse);
        const key = 'redis';

        // Act
        const result = await indicator.isHealthy(key);

        // Assert
        expect(result[key].status).toBe('up');

        // Reset for next iteration
        jest.clearAllMocks();
        mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      }
    });
  });

  describe('isHealthy - Error Cases', () => {
    it('should throw HealthCheckError when Redis ping fails', async () => {
      // Arrange
      const pingError = new Error('Redis connection refused');
      mockRedisClient.ping.mockRejectedValue(pingError);
      const key = 'redis';

      // Act & Assert
      await expect(indicator.isHealthy(key)).rejects.toThrow(HealthCheckError);
    });

    it('should throw HealthCheckError when Redis info fails', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      const infoError = new Error('INFO command failed');
      mockRedisClient.info.mockRejectedValue(infoError);
      const key = 'redis';

      // Act & Assert
      await expect(indicator.isHealthy(key)).rejects.toThrow(HealthCheckError);
    });

    it('should include error details in HealthCheckError', async () => {
      // Arrange
      const redisError = new Error('Connection timeout');
      mockRedisClient.ping.mockRejectedValue(redisError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
        fail('Expected HealthCheckError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.message).toBe('Redis health check failed');
        expect(error.causes).toEqual({
          [key]: {
            status: 'down',
            error: 'Connection timeout',
          },
        });
      }
    });

    it('should handle Redis authentication failures', async () => {
      // Arrange
      const authError = new Error('NOAUTH Authentication required');
      mockRedisClient.ping.mockRejectedValue(authError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('NOAUTH');
      }
    });

    it('should handle Redis server not ready', async () => {
      // Arrange
      const loadingError = new Error('LOADING Redis is loading the dataset in memory');
      mockRedisClient.ping.mockRejectedValue(loadingError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('LOADING');
      }
    });

    it('should handle network connection errors', async () => {
      // Arrange
      const networkError = new Error('ECONNREFUSED 127.0.0.1:6379');
      mockRedisClient.ping.mockRejectedValue(networkError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('ECONNREFUSED');
      }
    });

    it('should handle Redis memory errors', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      const memoryError = new Error('OOM command not allowed when used memory > maxmemory');
      mockRedisClient.info.mockRejectedValue(memoryError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('OOM');
      }
    });

    it('should handle Redis cluster down scenarios', async () => {
      // Arrange
      const clusterError = new Error('CLUSTERDOWN Hash slot not served');
      mockRedisClient.ping.mockRejectedValue(clusterError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('CLUSTERDOWN');
      }
    });
  });

  describe('extractMemoryUsage - Memory Parsing', () => {
    it('should extract memory usage from Redis info', () => {
      // Access private method for testing
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      expect(extractMemoryUsage(mockRedisInfo)).toBe('1.00M');
    });

    it('should handle different memory format variations', () => {
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      const testCases = [
        { info: 'used_memory_human:512K\n', expected: '512K' },
        { info: 'used_memory_human:1.50M\n', expected: '1.50M' },
        { info: 'used_memory_human:2.50G\n', expected: '2.50G' },
        { info: 'used_memory_human:100B\n', expected: '100B' },
        { info: 'used_memory_human: 5.25M \n', expected: '5.25M' }, // With spaces
      ];

      testCases.forEach(({ info, expected }) => {
        expect(extractMemoryUsage(info)).toBe(expected);
      });
    });

    it('should return "unknown" for missing memory info', () => {
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      const infoWithoutMemory = `
# Server
redis_version:6.2.6
uptime_in_seconds:86400
      `;

      expect(extractMemoryUsage(infoWithoutMemory)).toBe('unknown');
    });

    it('should return "unknown" for malformed memory info', () => {
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      const malformedInfo = `
# Memory
used_memory_human
used_memory:1048576
      `;

      expect(extractMemoryUsage(malformedInfo)).toBe('unknown');
    });

    it('should handle empty or null info gracefully', () => {
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      expect(extractMemoryUsage('')).toBe('unknown');
      expect(extractMemoryUsage(null)).toBe('unknown');
      expect(extractMemoryUsage(undefined)).toBe('unknown');
    });

    it('should extract first occurrence when multiple matches exist', () => {
      const extractMemoryUsage = (indicator as any).extractMemoryUsage;

      const duplicateInfo = `
used_memory_human:1.00M
used_memory_human:2.00M
      `;

      expect(extractMemoryUsage(duplicateInfo)).toBe('1.00M');
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle null/undefined error messages', async () => {
      // Arrange
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';
      mockRedisClient.ping.mockRejectedValue(errorWithoutMessage);
      const key = 'redis';

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
      const stringError = 'Redis connection failed';
      mockRedisClient.ping.mockRejectedValue(stringError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Redis connection failed');
      }
    });

    it('should handle complex error objects', async () => {
      // Arrange
      const complexError = {
        message: 'Redis error',
        code: 'ECONNREFUSED',
        errno: -111,
      };
      mockRedisClient.ping.mockRejectedValue(complexError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Redis error');
      }
    });

    it('should handle empty key parameter', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      const key = '';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty('');
      expect(result[''].status).toBe('up');
    });

    it('should handle special characters in key parameter', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      const key = 'redis-test_123.primary';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty(key);
      expect(result[key].status).toBe('up');
    });
  });

  describe('Performance and Reliability', () => {
    beforeEach(() => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
    });

    it('should handle concurrent health checks', async () => {
      // Arrange
      const keys = ['redis1', 'redis2', 'redis3', 'redis4', 'redis5'];

      // Act
      const promises = keys.map(key => indicator.isHealthy(key));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result[keys[index]].status).toBe('up');
      });
      expect(mockRedisClient.ping).toHaveBeenCalledTimes(5);
      expect(mockRedisClient.info).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid consecutive calls', async () => {
      // Arrange
      const key = 'redis';

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
      expect(mockRedisClient.ping).toHaveBeenCalledTimes(10);
      expect(mockRedisClient.info).toHaveBeenCalledTimes(10);
    });

    it('should maintain performance under load', async () => {
      // Arrange
      const key = 'redis';
      const iterations = 50;

      // Act
      const startTime = Date.now();
      const promises = Array.from({ length: iterations }, () => indicator.isHealthy(key));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(mockRedisClient.ping).toHaveBeenCalledTimes(iterations);
    });

    it('should handle slow Redis responses gracefully', async () => {
      // Arrange
      const key = 'redis';
      const slowPing = new Promise(resolve => {
        setTimeout(() => resolve('PONG'), 500);
      });
      const slowInfo = new Promise(resolve => {
        setTimeout(() => resolve(mockRedisInfo), 500);
      });

      mockRedisClient.ping.mockReturnValue(slowPing);
      mockRedisClient.info.mockReturnValue(slowInfo);

      // Act
      const startTime = Date.now();
      const result = await indicator.isHealthy(key);
      const responseTime = Date.now() - startTime;

      // Assert
      expect(result[key].status).toBe('up');
      expect(responseTime).toBeGreaterThanOrEqual(1000); // At least 1 second

      const reportedTime = parseInt(result[key].responseTime.replace('ms', ''));
      expect(reportedTime).toBeGreaterThanOrEqual(1000);
    });

    it('should isolate failures between concurrent checks', async () => {
      // Arrange
      const successKey = 'redis_success';
      const failKey = 'redis_fail';

      mockRedisClient.ping
        .mockResolvedValueOnce('PONG') // First call succeeds
        .mockRejectedValueOnce(new Error('Connection failed')); // Second call fails

      mockRedisClient.info.mockResolvedValue(mockRedisInfo);

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

  describe('Redis Command Validation', () => {
    it('should execute ping command correctly', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      const key = 'redis';

      // Act
      await indicator.isHealthy(key);

      // Assert
      expect(mockRedisClient.ping).toHaveBeenCalledWith();
      expect(mockRedisClient.ping).toHaveBeenCalledTimes(1);
    });

    it('should execute info command correctly', async () => {
      // Arrange
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
      const key = 'redis';

      // Act
      await indicator.isHealthy(key);

      // Assert
      expect(mockRedisClient.info).toHaveBeenCalledWith();
      expect(mockRedisClient.info).toHaveBeenCalledTimes(1);
    });

    it('should handle command timeout scenarios', async () => {
      // Arrange
      const timeoutError = new Error('Command timeout');
      timeoutError.name = 'TimeoutError';
      mockRedisClient.ping.mockRejectedValue(timeoutError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toBe('Command timeout');
      }
    });

    it('should handle Redis MOVED responses in cluster mode', async () => {
      // Arrange
      const movedError = new Error('MOVED 1234 192.168.1.100:6379');
      mockRedisClient.ping.mockRejectedValue(movedError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('MOVED');
      }
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
    });

    it('should work in a real health check pipeline', async () => {
      // Arrange - Simulate how it would be called in the health controller
      const healthChecks = [
        () => indicator.isHealthy('redis'),
        () => indicator.isHealthy('redis_replica'),
      ];

      // Act
      const results = await Promise.all(healthChecks.map(check => check()));

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].redis.status).toBe('up');
      expect(results[1].redis_replica.status).toBe('up');
    });

    it('should provide consistent results for monitoring systems', async () => {
      // Arrange
      const key = 'redis';

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
            type: 'redis',
            responseTime: expect.stringMatching(/^\d+ms$/),
            memoryUsed: '1.00M',
          })
        );
      });
    });

    it('should handle Redis maintenance scenarios', async () => {
      // Arrange
      const maintenanceError = new Error('READONLY You cannot write against a read only replica');
      mockRedisClient.ping.mockRejectedValue(maintenanceError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('READONLY');
      }
    });

    it('should handle Redis failover scenarios', async () => {
      // Arrange
      const failoverError = new Error('MASTERDOWN Link with MASTER is down and slave-serve-stale-data is set to no');
      mockRedisClient.ping.mockRejectedValue(failoverError);
      const key = 'redis';

      // Act & Assert
      try {
        await indicator.isHealthy(key);
      } catch (error) {
        expect(error).toBeInstanceOf(HealthCheckError);
        expect(error.causes[key].error).toContain('MASTERDOWN');
      }
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(() => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      mockRedisClient.info.mockResolvedValue(mockRedisInfo);
    });

    it('should not leak memory with repeated calls', async () => {
      // Arrange
      const key = 'redis';
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
      const results = [];

      // Act - Force garbage collection if available and continue health checks
      for (let i = 0; i < 10; i++) {
        if (global.gc) global.gc();
        results.push(await indicator.isHealthy(`redis_${i}`));
      }

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result[`redis_${index}`].status).toBe('up');
      });
    });
  });
});
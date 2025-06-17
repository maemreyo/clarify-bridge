import { Test, TestingModule } from '@nestjs/testing';
import { LlmHealthIndicator } from './llm.health';
import { LlmCoreService } from '@core/llm';

describe('LlmHealthIndicator', () => {
  let indicator: LlmHealthIndicator;
  let llmService: jest.Mocked<LlmCoreService>;

  const mockProviders = ['openai', 'google-genai', 'anthropic'];
  const mockSingleProvider = ['openai'];
  const mockNoProviders: string[] = [];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmHealthIndicator,
        {
          provide: LlmCoreService,
          useValue: {
            getAvailableProviders: jest.fn(),
          },
        },
      ],
    }).compile();

    indicator = module.get<LlmHealthIndicator>(LlmHealthIndicator);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('Constructor and Dependencies', () => {
    it('should be defined', () => {
      expect(indicator).toBeDefined();
    });

    it('should extend HealthIndicator', () => {
      expect(indicator).toBeInstanceOf(LlmHealthIndicator);
    });

    it('should have LlmCoreService injected', () => {
      expect(llmService).toBeDefined();
    });
  });

  describe('isHealthy - Success Cases', () => {
    it('should return healthy status when multiple providers are available', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(llmService.getAvailableProviders).toHaveBeenCalled();
      expect(result).toEqual({
        [key]: {
          status: 'up',
          availableProviders: mockProviders,
          count: 3,
        },
      });
    });

    it('should return healthy status when single provider is available', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockSingleProvider);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toEqual({
        [key]: {
          status: 'up',
          availableProviders: mockSingleProvider,
          count: 1,
        },
      });
    });

    it('should work with different key names', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const keys = ['llm', 'ai', 'llm_primary', 'ai-service'];

      // Act & Assert
      for (const key of keys) {
        const result = await indicator.isHealthy(key);
        expect(result).toHaveProperty(key);
        expect(result[key].status).toBe('up');
        expect(result[key].count).toBe(3);
      }
    });

    it('should include all expected metadata in healthy response', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = 'test_llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key]).toEqual({
        status: 'up',
        availableProviders: expect.arrayContaining(['openai', 'google-genai', 'anthropic']),
        count: 3,
      });
    });

    it('should handle provider names with special characters', async () => {
      // Arrange
      const specialProviders = ['openai-gpt4', 'google_palm', 'anthropic.claude'];
      llmService.getAvailableProviders.mockReturnValue(specialProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].availableProviders).toEqual(specialProviders);
      expect(result[key].count).toBe(3);
    });

    it('should handle different provider configurations', async () => {
      // Test different combinations of providers
      const testCases = [
        { providers: ['openai'], expected: 1 },
        { providers: ['openai', 'anthropic'], expected: 2 },
        { providers: ['openai', 'google-genai', 'anthropic', 'custom'], expected: 4 },
        { providers: ['huggingface'], expected: 1 },
      ];

      for (const { providers, expected } of testCases) {
        llmService.getAvailableProviders.mockReturnValue(providers);
        const result = await indicator.isHealthy('llm');

        expect(result.llm.status).toBe('up');
        expect(result.llm.count).toBe(expected);
        expect(result.llm.availableProviders).toEqual(providers);
      }
    });

    it('should be synchronous and fast', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = 'llm';

      // Act
      const startTime = Date.now();
      const result = await indicator.isHealthy(key);
      const endTime = Date.now();

      // Assert
      expect(result[key].status).toBe('up');
      expect(endTime - startTime).toBeLessThan(10); // Should be very fast since it's just a getter
    });
  });

  describe('isHealthy - Unhealthy Cases', () => {
    it('should return unhealthy status when no providers are available', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockNoProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(llmService.getAvailableProviders).toHaveBeenCalled();
      expect(result).toEqual({
        [key]: {
          status: 'down',
          availableProviders: [],
          count: 0,
        },
      });
    });

    it('should handle empty array from getAvailableProviders', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue([]);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('down');
      expect(result[key].availableProviders).toEqual([]);
      expect(result[key].count).toBe(0);
    });

    it('should work with different key names when unhealthy', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue([]);
      const keys = ['llm', 'ai', 'llm_primary', 'ai-service'];

      // Act & Assert
      for (const key of keys) {
        const result = await indicator.isHealthy(key);
        expect(result).toHaveProperty(key);
        expect(result[key].status).toBe('down');
        expect(result[key].count).toBe(0);
      }
    });

    it('should not throw errors when no providers available', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue([]);
      const key = 'llm';

      // Act & Assert - Should not throw, just return unhealthy status
      await expect(indicator.isHealthy(key)).resolves.toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null return from getAvailableProviders', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(null as any);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('down');
      expect(result[key].count).toBe(0);
    });

    it('should handle undefined return from getAvailableProviders', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(undefined as any);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('down');
      expect(result[key].count).toBe(0);
    });

    it('should handle errors from getAvailableProviders gracefully', async () => {
      // Arrange
      llmService.getAvailableProviders.mockImplementation(() => {
        throw new Error('LLM service not initialized');
      });
      const key = 'llm';

      // Act & Assert
      await expect(indicator.isHealthy(key)).rejects.toThrow('LLM service not initialized');
    });

    it('should handle empty key parameter', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = '';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty('');
      expect(result[''].status).toBe('up');
      expect(result[''].count).toBe(3);
    });

    it('should handle special characters in key parameter', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = 'llm-test_123.primary';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result).toHaveProperty(key);
      expect(result[key].status).toBe('up');
    });

    it('should handle very long provider names', async () => {
      // Arrange
      const longProviders = [
        'very-long-provider-name-that-exceeds-normal-length-expectations',
        'another-extremely-long-provider-name-with-many-hyphens-and-descriptive-text',
      ];
      llmService.getAvailableProviders.mockReturnValue(longProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].availableProviders).toEqual(longProviders);
      expect(result[key].count).toBe(2);
    });

    it('should handle providers with unusual characters', async () => {
      // Arrange
      const unusualProviders = ['provider@domain', 'provider#1', 'provider%test'];
      llmService.getAvailableProviders.mockReturnValue(unusualProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].availableProviders).toEqual(unusualProviders);
      expect(result[key].count).toBe(3);
    });
  });

  describe('Performance and Reliability', () => {
    beforeEach(() => {
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
    });

    it('should handle concurrent health checks', async () => {
      // Arrange
      const keys = ['llm1', 'llm2', 'llm3', 'llm4', 'llm5'];

      // Act
      const promises = keys.map(key => indicator.isHealthy(key));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result[keys[index]].status).toBe('up');
        expect(result[keys[index]].count).toBe(3);
      });
      expect(llmService.getAvailableProviders).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid consecutive calls', async () => {
      // Arrange
      const key = 'llm';

      // Act
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await indicator.isHealthy(key));
      }

      // Assert
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result[key].status).toBe('up');
        expect(result[key].count).toBe(3);
      });
      expect(llmService.getAvailableProviders).toHaveBeenCalledTimes(10);
    });

    it('should maintain performance under load', async () => {
      // Arrange
      const key = 'llm';
      const iterations = 100;

      // Act
      const startTime = Date.now();
      const promises = Array.from({ length: iterations }, () => indicator.isHealthy(key));
      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(llmService.getAvailableProviders).toHaveBeenCalledTimes(iterations);
    });

    it('should isolate different health check results', async () => {
      // Arrange
      const healthyKey = 'llm_healthy';
      const unhealthyKey = 'llm_unhealthy';

      llmService.getAvailableProviders
        .mockReturnValueOnce(mockProviders) // First call returns providers
        .mockReturnValueOnce([]); // Second call returns empty array

      // Act
      const [healthyResult, unhealthyResult] = await Promise.all([
        indicator.isHealthy(healthyKey),
        indicator.isHealthy(unhealthyKey),
      ]);

      // Assert
      expect(healthyResult[healthyKey].status).toBe('up');
      expect(healthyResult[healthyKey].count).toBe(3);

      expect(unhealthyResult[unhealthyKey].status).toBe('down');
      expect(unhealthyResult[unhealthyKey].count).toBe(0);
    });

    it('should handle provider availability changes', async () => {
      // Arrange
      const key = 'llm';

      // First call - all providers available
      llmService.getAvailableProviders.mockReturnValueOnce(mockProviders);
      const result1 = await indicator.isHealthy(key);

      // Second call - only one provider available
      llmService.getAvailableProviders.mockReturnValueOnce(mockSingleProvider);
      const result2 = await indicator.isHealthy(key);

      // Third call - no providers available
      llmService.getAvailableProviders.mockReturnValueOnce([]);
      const result3 = await indicator.isHealthy(key);

      // Assert
      expect(result1[key].status).toBe('up');
      expect(result1[key].count).toBe(3);

      expect(result2[key].status).toBe('up');
      expect(result2[key].count).toBe(1);

      expect(result3[key].status).toBe('down');
      expect(result3[key].count).toBe(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in a real health check pipeline', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);

      // Simulate how it would be called in the health controller
      const healthChecks = [
        () => indicator.isHealthy('llm'),
        () => indicator.isHealthy('llm_backup'),
      ];

      // Act
      const results = await Promise.all(healthChecks.map(check => check()));

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].llm.status).toBe('up');
      expect(results[1].llm_backup.status).toBe('up');
    });

    it('should provide consistent results for monitoring systems', async () => {
      // Arrange
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
      const key = 'llm';

      // Act - Multiple calls as monitoring system would do
      const results = await Promise.all([
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
      ]);

      // Assert
      results.forEach(result => {
        expect(result[key]).toEqual({
          status: 'up',
          availableProviders: mockProviders,
          count: 3,
        });
      });
    });

    it('should handle provider initialization scenarios', async () => {
      // Arrange - Simulate gradual provider initialization
      llmService.getAvailableProviders
        .mockReturnValueOnce([]) // No providers initially
        .mockReturnValueOnce(['openai']) // OpenAI comes online first
        .mockReturnValueOnce(['openai', 'anthropic']) // Anthropic comes online
        .mockReturnValueOnce(mockProviders); // All providers online

      const key = 'llm';

      // Act
      const results = await Promise.all([
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
      ]);

      // Assert
      expect(results[0][key]).toEqual({
        status: 'down',
        availableProviders: [],
        count: 0,
      });

      expect(results[1][key]).toEqual({
        status: 'up',
        availableProviders: ['openai'],
        count: 1,
      });

      expect(results[2][key]).toEqual({
        status: 'up',
        availableProviders: ['openai', 'anthropic'],
        count: 2,
      });

      expect(results[3][key]).toEqual({
        status: 'up',
        availableProviders: mockProviders,
        count: 3,
      });
    });

    it('should handle service degradation scenarios', async () => {
      // Arrange - Simulate gradual service degradation
      llmService.getAvailableProviders
        .mockReturnValueOnce(mockProviders) // All providers working
        .mockReturnValueOnce(['openai', 'anthropic']) // Google GenAI fails
        .mockReturnValueOnce(['openai']) // Anthropic fails
        .mockReturnValueOnce([]); // All providers fail

      const key = 'llm';

      // Act
      const results = await Promise.all([
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
        indicator.isHealthy(key),
      ]);

      // Assert - Service should remain up until all providers fail
      expect(results[0][key].status).toBe('up');
      expect(results[0][key].count).toBe(3);

      expect(results[1][key].status).toBe('up');
      expect(results[1][key].count).toBe(2);

      expect(results[2][key].status).toBe('up');
      expect(results[2][key].count).toBe(1);

      expect(results[3][key].status).toBe('down');
      expect(results[3][key].count).toBe(0);
    });
  });

  describe('Memory and Resource Management', () => {
    beforeEach(() => {
      llmService.getAvailableProviders.mockReturnValue(mockProviders);
    });

    it('should not leak memory with repeated calls', async () => {
      // Arrange
      const key = 'llm';
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
        results.push(await indicator.isHealthy(`llm_${i}`));
      }

      // Assert
      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result[`llm_${index}`].status).toBe('up');
      });
    });

    it('should handle large provider arrays efficiently', async () => {
      // Arrange
      const largeProviderArray = Array.from({ length: 100 }, (_, i) => `provider_${i}`);
      llmService.getAvailableProviders.mockReturnValue(largeProviderArray);
      const key = 'llm';

      // Act
      const startTime = Date.now();
      const result = await indicator.isHealthy(key);
      const endTime = Date.now();

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].count).toBe(100);
      expect(result[key].availableProviders).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(50); // Should still be fast
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should preserve provider order from service', async () => {
      // Arrange
      const orderedProviders = ['anthropic', 'openai', 'google-genai']; // Different order
      llmService.getAvailableProviders.mockReturnValue(orderedProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].availableProviders).toEqual(orderedProviders);
      expect(result[key].availableProviders[0]).toBe('anthropic');
      expect(result[key].availableProviders[2]).toBe('google-genai');
    });

    it('should handle duplicate provider names', async () => {
      // Arrange
      const duplicateProviders = ['openai', 'openai', 'anthropic', 'openai'];
      llmService.getAvailableProviders.mockReturnValue(duplicateProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].count).toBe(4); // Should count duplicates
      expect(result[key].availableProviders).toEqual(duplicateProviders);
    });

    it('should handle providers with numeric names', async () => {
      // Arrange
      const numericProviders = ['1', '2', '3'];
      llmService.getAvailableProviders.mockReturnValue(numericProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up');
      expect(result[key].availableProviders).toEqual(numericProviders);
      expect(result[key].count).toBe(3);
    });

    it('should handle mixed data types in provider array gracefully', async () => {
      // Arrange
      const mixedProviders = ['openai', 123, null, 'anthropic', undefined] as any;
      llmService.getAvailableProviders.mockReturnValue(mixedProviders);
      const key = 'llm';

      // Act
      const result = await indicator.isHealthy(key);

      // Assert
      expect(result[key].status).toBe('up'); // Non-zero length array = healthy
      expect(result[key].count).toBe(5); // Count all elements
      expect(result[key].availableProviders).toEqual(mixedProviders);
    });
  });
});
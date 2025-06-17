import { TrackPerformance } from './track-performance.decorator';
import { MonitoringService } from '../monitoring.service';

describe('TrackPerformance Decorator', () => {
  let mockMonitoringService: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    mockMonitoringService = {
      trackPerformance: jest.fn(),
      incrementCounter: jest.fn(),
      setGauge: jest.fn(),
      logWithContext: jest.fn(),
      trackUserActivity: jest.fn(),
      trackTeamActivity: jest.fn(),
      trackBusinessMetric: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  describe('Decorator Application', () => {
    it('should apply decorator to method successfully', () => {
      // Arrange
      class TestService {
        @TrackPerformance()
        async testMethod(): Promise<string> {
          return 'test result';
        }
      }

      // Act
      const instance = new TestService();

      // Assert
      expect(instance.testMethod).toBeDefined();
      expect(typeof instance.testMethod).toBe('function');
    });

    it('should preserve original method name and properties', () => {
      // Arrange
      class TestService {
        @TrackPerformance()
        async namedMethod(): Promise<void> {
          // Method implementation
        }
      }

      // Act
      const instance = new TestService();
      const method = instance.namedMethod;

      // Assert
      expect(method).toBeDefined();
      expect(typeof method).toBe('function');
    });

    it('should work with multiple decorated methods in same class', () => {
      // Arrange
      class TestService {
        @TrackPerformance('operation1')
        async method1(): Promise<string> {
          return 'result1';
        }

        @TrackPerformance('operation2')
        async method2(): Promise<string> {
          return 'result2';
        }

        @TrackPerformance()
        async method3(): Promise<string> {
          return 'result3';
        }
      }

      // Act
      const instance = new TestService();

      // Assert
      expect(instance.method1).toBeDefined();
      expect(instance.method2).toBeDefined();
      expect(instance.method3).toBeDefined();
      expect(typeof instance.method1).toBe('function');
      expect(typeof instance.method2).toBe('function');
      expect(typeof instance.method3).toBe('function');
    });

    it('should work with inheritance', () => {
      // Arrange
      class BaseService {
        @TrackPerformance('base_operation')
        async baseMethod(): Promise<string> {
          return 'base result';
        }
      }

      class DerivedService extends BaseService {
        @TrackPerformance('derived_operation')
        async derivedMethod(): Promise<string> {
          return 'derived result';
        }
      }

      // Act
      const instance = new DerivedService();

      // Assert
      expect(instance.baseMethod).toBeDefined();
      expect(instance.derivedMethod).toBeDefined();
    });
  });

  describe('Monitoring Service Integration', () => {
    it('should inject monitoring service into target class', () => {
      // Arrange
      class TestService {
        public monitoringService: MonitoringService;

        @TrackPerformance()
        async testMethod(): Promise<string> {
          return 'test';
        }
      }

      // Act
      const instance = new TestService();
      instance.monitoringService = mockMonitoringService;

      // Assert
      expect(instance.monitoringService).toBeDefined();
      expect(instance.monitoringService).toBe(mockMonitoringService);
    });

    it('should call trackPerformance with default operation name', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async testMethod(): Promise<string> {
          return 'result';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.testMethod();

      // Assert
      expect(result).toBe('result');
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'TestService.testMethod',
        expect.any(Function)
      );
    });

    it('should call trackPerformance with custom operation name', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('custom_operation')
        async testMethod(): Promise<string> {
          return 'result';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.testMethod();

      // Assert
      expect(result).toBe('result');
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'custom_operation',
        expect.any(Function)
      );
    });

    it('should handle case when monitoring service is not available', async () => {
      // Arrange
      class TestService {
        public monitoringService: MonitoringService; // undefined

        @TrackPerformance()
        async testMethod(): Promise<string> {
          return 'result';
        }
      }

      const instance = new TestService();

      // Act & Assert - Should not throw error
      await expect(instance.testMethod()).rejects.toThrow();
    });
  });

  describe('Method Execution and Return Values', () => {
    it('should return original method result for successful execution', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async getValue(): Promise<number> {
          return 42;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.getValue();

      // Assert
      expect(result).toBe(42);
    });

    it('should return complex objects correctly', async () => {
      // Arrange
      const complexObject = {
        id: 'test-123',
        data: { nested: { value: 'test' } },
        array: [1, 2, 3],
      };

      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async getComplexObject(): Promise<typeof complexObject> {
          return complexObject;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.getComplexObject();

      // Assert
      expect(result).toEqual(complexObject);
      expect(result).toBe(complexObject); // Should be same reference
    });

    it('should handle methods that return promises', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async asyncMethod(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'async result';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.asyncMethod();

      // Assert
      expect(result).toBe('async result');
    });

    it('should handle methods with parameters', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async processData(input: string, multiplier: number): Promise<string> {
          return input.repeat(multiplier);
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.processData('test', 3);

      // Assert
      expect(result).toBe('testtesttest');
    });

    it('should pass all arguments to original method', async () => {
      // Arrange
      const mockOriginalMethod = jest.fn().mockResolvedValue('mocked result');

      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async methodWithArgs(arg1: string, arg2: number, arg3: object): Promise<string> {
          return mockOriginalMethod(arg1, arg2, arg3);
        }
      }

      const instance = new TestService();
      const testArgs = ['test', 123, { key: 'value' }];
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.methodWithArgs(testArgs[0], testArgs[1] as number, testArgs[2]);

      // Assert
      expect(mockOriginalMethod).toHaveBeenCalledWith(...testArgs);
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from original method', async () => {
      // Arrange
      const originalError = new Error('Original method error');

      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async failingMethod(): Promise<string> {
          throw originalError;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn(); // This will throw
      });

      // Act & Assert
      await expect(instance.failingMethod()).rejects.toThrow(originalError);
    });

    it('should still call trackPerformance even when method fails', async () => {
      // Arrange
      const originalError = new Error('Method failed');

      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('failing_operation')
        async failingMethod(): Promise<string> {
          throw originalError;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        try {
          return await fn();
        } catch (error) {
          throw error; // Re-throw to maintain error behavior
        }
      });

      // Act & Assert
      await expect(instance.failingMethod()).rejects.toThrow(originalError);
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'failing_operation',
        expect.any(Function)
      );
    });

    it('should handle monitoring service errors gracefully', async () => {
      // Arrange
      const monitoringError = new Error('Monitoring service error');

      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async normalMethod(): Promise<string> {
          return 'success';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockRejectedValue(monitoringError);

      // Act & Assert
      await expect(instance.normalMethod()).rejects.toThrow(monitoringError);
    });

    it('should handle different error types', async () => {
      // Test different error types
      const errorTypes = [
        new Error('Standard Error'),
        new TypeError('Type Error'),
        new RangeError('Range Error'),
        'String error',
        { message: 'Object error' },
        null,
        undefined,
      ];

      for (const error of errorTypes) {
        // Arrange
        class TestService {
          public monitoringService = mockMonitoringService;

          @TrackPerformance()
          async testMethod(): Promise<string> {
            throw error;
          }
        }

        const instance = new TestService();
        mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
          return await fn();
        });

        // Act & Assert
        await expect(instance.testMethod()).rejects.toThrow();

        // Reset for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Operation Name Generation', () => {
    it('should generate correct operation name for simple class', async () => {
      // Arrange
      class SimpleService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async execute(): Promise<void> {
          // Implementation
        }
      }

      const instance = new SimpleService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.execute();

      // Assert
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'SimpleService.execute',
        expect.any(Function)
      );
    });

    it('should generate correct operation name for complex class names', async () => {
      // Arrange
      class VeryLongAndComplexServiceNameWithMultipleWords {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async performComplexOperation(): Promise<void> {
          // Implementation
        }
      }

      const instance = new VeryLongAndComplexServiceNameWithMultipleWords();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.performComplexOperation();

      // Assert
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'VeryLongAndComplexServiceNameWithMultipleWords.performComplexOperation',
        expect.any(Function)
      );
    });

    it('should use custom operation name when provided', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('custom.operation.name')
        async method(): Promise<void> {
          // Implementation
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.method();

      // Assert
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'custom.operation.name',
        expect.any(Function)
      );
    });

    it('should handle empty string as operation name', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('')
        async method(): Promise<void> {
          // Implementation
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.method();

      // Assert
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        '',
        expect.any(Function)
      );
    });

    it('should handle special characters in operation name', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('operation:with/special-characters.test@2024')
        async method(): Promise<void> {
          // Implementation
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      await instance.method();

      // Assert
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'operation:with/special-characters.test@2024',
        expect.any(Function)
      );
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle concurrent method calls', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('concurrent_operation')
        async concurrentMethod(id: number): Promise<number> {
          await new Promise(resolve => setTimeout(resolve, 10));
          return id * 2;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const promises = Array.from({ length: 5 }, (_, i) =>
        instance.concurrentMethod(i)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(results).toEqual([0, 2, 4, 6, 8]);
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledTimes(5);
    });

    it('should not interfere with method binding', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;
        private value = 'instance value';

        @TrackPerformance()
        async getValue(): Promise<string> {
          return this.value;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const boundMethod = instance.getValue.bind(instance);
      const result = await boundMethod();

      // Assert
      expect(result).toBe('instance value');
    });

    it('should handle methods with default parameters', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async methodWithDefaults(
          required: string,
          optional: number = 42,
          optionalString: string = 'default'
        ): Promise<string> {
          return `${required}-${optional}-${optionalString}`;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result1 = await instance.methodWithDefaults('test');
      const result2 = await instance.methodWithDefaults('test', 100);
      const result3 = await instance.methodWithDefaults('test', 100, 'custom');

      // Assert
      expect(result1).toBe('test-42-default');
      expect(result2).toBe('test-100-default');
      expect(result3).toBe('test-100-custom');
    });

    it('should handle methods with rest parameters', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async methodWithRest(first: string, ...rest: number[]): Promise<string> {
          return `${first}:${rest.join(',')}`;
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const result = await instance.methodWithRest('prefix', 1, 2, 3, 4, 5);

      // Assert
      expect(result).toBe('prefix:1,2,3,4,5');
    });

    it('should handle very long method execution times', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance('long_operation')
        async longRunningMethod(): Promise<string> {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'completed';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act
      const startTime = Date.now();
      const result = await instance.longRunningMethod();
      const endTime = Date.now();

      // Assert
      expect(result).toBe('completed');
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledWith(
        'long_operation',
        expect.any(Function)
      );
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not create memory leaks with repeated method calls', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async testMethod(): Promise<string> {
          return 'result';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Many repeated calls
      for (let i = 0; i < 100; i++) {
        await instance.testMethod();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
      expect(mockMonitoringService.trackPerformance).toHaveBeenCalledTimes(100);
    });

    it('should handle garbage collection during decorated method execution', async () => {
      // Arrange
      class TestService {
        public monitoringService = mockMonitoringService;

        @TrackPerformance()
        async methodWithGC(): Promise<string> {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
          return 'gc result';
        }
      }

      const instance = new TestService();
      mockMonitoringService.trackPerformance.mockImplementation(async (operation, fn) => {
        return await fn();
      });

      // Act & Assert - Should not throw error
      const result = await instance.methodWithGC();
      expect(result).toBe('gc result');
    });
  });
});
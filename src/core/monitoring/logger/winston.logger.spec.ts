import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

// Mock winston and nest-winston utilities
jest.mock('winston', () => {
  const originalWinston = jest.requireActual('winston');
  return {
    ...originalWinston,
    createLogger: jest.fn(),
    format: {
      ...originalWinston.format,
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

jest.mock('nest-winston', () => ({
  utilities: {
    format: {
      nestLike: jest.fn(),
    },
  },
}));

describe('Winston Logger Configuration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create mock logger instance
    mockLogger = {
      add: jest.fn(),
      remove: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      configure: jest.fn(),
    } as any;

    // Mock winston.createLogger to return our mock
    (winston.createLogger as jest.Mock).mockReturnValue(mockLogger);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clear module cache to ensure fresh imports
    jest.resetModules();
  });

  describe('Logger Creation and Configuration', () => {
    it('should create logger with correct configuration in development', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      process.env.LOG_LEVEL = 'debug';

      // Mock format functions
      const mockDevelopmentFormat = 'development-format';
      (winston.format.combine as jest.Mock).mockReturnValue(mockDevelopmentFormat);
      (winston.format.timestamp as jest.Mock).mockReturnValue('timestamp-format');
      (winston.format.errors as jest.Mock).mockReturnValue('errors-format');
      (nestWinstonModuleUtilities.format.nestLike as jest.Mock).mockReturnValue('nestlike-format');

      // Act - Import the logger (this triggers the configuration)
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'debug',
        format: mockDevelopmentFormat,
        defaultMeta: { service: 'clarity-bridge' },
        transports: [
          expect.any(Object), // Console transport
        ],
      });

      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalledWith('ClarityBridge', {
        prettyPrint: true,
        colors: true,
      });
    });

    it('should create logger with correct configuration in production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      process.env.LOG_LEVEL = 'warn';

      // Mock format functions
      const mockProductionFormat = 'production-format';
      (winston.format.combine as jest.Mock).mockReturnValue(mockProductionFormat);
      (winston.format.json as jest.Mock).mockReturnValue('json-format');

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith({
        level: 'warn',
        format: mockProductionFormat,
        defaultMeta: { service: 'clarity-bridge' },
        transports: [
          expect.any(Object), // Console transport
        ],
      });

      expect(winston.format.json).toHaveBeenCalled();
      expect(nestWinstonModuleUtilities.format.nestLike).not.toHaveBeenCalled();
    });

    it('should use default log level when LOG_LEVEL is not set', async () => {
      // Arrange
      delete process.env.LOG_LEVEL;
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info', // Default level
        })
      );
    });

    it('should use custom log level when LOG_LEVEL is set', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'error';
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    it('should include correct default metadata', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultMeta: { service: 'clarity-bridge' },
        })
      );
    });
  });

  describe('Transport Configuration', () => {
    it('should configure Console transport correctly', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockConsoleTransport = { type: 'console' };
      (winston.transports.Console as jest.Mock).mockReturnValue(mockConsoleTransport);

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.Console).toHaveBeenCalledWith({
        stderrLevels: ['error'],
      });
    });

    it('should add File transports in production environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockFileTransport = { type: 'file' };
      (winston.transports.File as jest.Mock).mockReturnValue(mockFileTransport);

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.File).toHaveBeenCalledTimes(2);

      // Error log file
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });

      // Combined log file
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });

      expect(mockLogger.add).toHaveBeenCalledTimes(2);
    });

    it('should not add File transports in development environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.File).not.toHaveBeenCalled();
      expect(mockLogger.add).not.toHaveBeenCalled();
    });

    it('should not add File transports when NODE_ENV is not production', async () => {
      // Test various non-production environments
      const environments = ['development', 'test', 'staging', undefined, ''];

      for (const env of environments) {
        // Reset mocks
        jest.clearAllMocks();
        jest.resetModules();

        // Set environment
        if (env === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = env;
        }

        // Act
        await import('../winston.logger');

        // Assert
        expect(winston.transports.File).not.toHaveBeenCalled();
        expect(mockLogger.add).not.toHaveBeenCalled();
      }
    });
  });

  describe('Format Configuration', () => {
    it('should configure development format correctly', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalledWith('ClarityBridge', {
        prettyPrint: true,
        colors: true,
      });
    });

    it('should configure production format correctly', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.format.combine).toHaveBeenCalled();
      expect(winston.format.timestamp).toHaveBeenCalled();
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
      expect(winston.format.json).toHaveBeenCalled();
      expect(nestWinstonModuleUtilities.format.nestLike).not.toHaveBeenCalled();
    });

    it('should handle errors format with stack traces', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.format.errors).toHaveBeenCalledWith({ stack: true });
    });
  });

  describe('Environment Detection', () => {
    it('should correctly detect development environment', async () => {
      // Test various development-like environments
      const devEnvironments = ['development', 'dev', 'local'];

      for (const env of devEnvironments) {
        // Reset
        jest.clearAllMocks();
        jest.resetModules();
        process.env.NODE_ENV = env;

        // Act
        await import('../winston.logger');

        // Assert - Should use development format (nestLike)
        expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalled();
        expect(winston.format.json).not.toHaveBeenCalled();
      }
    });

    it('should correctly detect production environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert - Should use production format (json)
      expect(winston.format.json).toHaveBeenCalled();
      expect(nestWinstonModuleUtilities.format.nestLike).not.toHaveBeenCalled();
    });

    it('should treat undefined NODE_ENV as development', async () => {
      // Arrange
      delete process.env.NODE_ENV;

      // Act
      await import('../winston.logger');

      // Assert - Should use development format
      expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalled();
      expect(winston.format.json).not.toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });

    it('should treat empty NODE_ENV as development', async () => {
      // Arrange
      process.env.NODE_ENV = '';

      // Act
      await import('../winston.logger');

      // Assert - Should use development format
      expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });

    it('should treat test environment as development', async () => {
      // Arrange
      process.env.NODE_ENV = 'test';

      // Act
      await import('../winston.logger');

      // Assert - Should use development format
      expect(nestWinstonModuleUtilities.format.nestLike).toHaveBeenCalled();
      expect(winston.transports.File).not.toHaveBeenCalled();
    });
  });

  describe('Logger Export and Usage', () => {
    it('should export winstonLogger instance', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      const loggerModule = await import('../winston.logger');

      // Assert
      expect(loggerModule.winstonLogger).toBeDefined();
      expect(loggerModule.winstonLogger).toBe(mockLogger);
    });

    it('should create logger only once per import', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act - Import multiple times
      await import('../winston.logger');
      await import('../winston.logger');
      await import('../winston.logger');

      // Assert - createLogger should only be called once
      expect(winston.createLogger).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle various log levels', async () => {
      const logLevels = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

      for (const level of logLevels) {
        // Reset
        jest.clearAllMocks();
        jest.resetModules();
        process.env.LOG_LEVEL = level;
        process.env.NODE_ENV = 'development';

        // Act
        await import('../winston.logger');

        // Assert
        expect(winston.createLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            level,
          })
        );
      }
    });

    it('should handle invalid log levels gracefully', async () => {
      // Arrange
      process.env.LOG_LEVEL = 'invalid-level';
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert - Should still create logger with the provided level
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'invalid-level',
        })
      );
    });

    it('should handle numeric log levels', async () => {
      // Arrange
      process.env.LOG_LEVEL = '3'; // Winston supports numeric levels
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.createLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: '3',
        })
      );
    });
  });

  describe('File Transport Configuration Details', () => {
    it('should configure error log file with correct parameters', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });
    });

    it('should configure combined log file with correct parameters', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.File).toHaveBeenCalledWith({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      });
    });

    it('should add file transports to logger in production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockErrorTransport = { type: 'error-file' };
      const mockCombinedTransport = { type: 'combined-file' };

      (winston.transports.File as jest.Mock)
        .mockReturnValueOnce(mockErrorTransport)
        .mockReturnValueOnce(mockCombinedTransport);

      // Act
      await import('../winston.logger');

      // Assert
      expect(mockLogger.add).toHaveBeenCalledTimes(2);
      expect(mockLogger.add).toHaveBeenNthCalledWith(1, mockErrorTransport);
      expect(mockLogger.add).toHaveBeenNthCalledWith(2, mockCombinedTransport);
    });
  });

  describe('Console Transport Configuration', () => {
    it('should configure stderr levels for errors', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.Console).toHaveBeenCalledWith({
        stderrLevels: ['error'],
      });
    });

    it('should use same console configuration in production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.transports.Console).toHaveBeenCalledWith({
        stderrLevels: ['error'],
      });
    });
  });

  describe('Format Chain Configuration', () => {
    it('should combine formats in correct order for development', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const mockTimestamp = 'timestamp-format';
      const mockErrors = 'errors-format';
      const mockNestLike = 'nestlike-format';

      (winston.format.timestamp as jest.Mock).mockReturnValue(mockTimestamp);
      (winston.format.errors as jest.Mock).mockReturnValue(mockErrors);
      (nestWinstonModuleUtilities.format.nestLike as jest.Mock).mockReturnValue(mockNestLike);

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.format.combine).toHaveBeenCalledWith(
        mockTimestamp,
        mockErrors,
        mockNestLike
      );
    });

    it('should combine formats in correct order for production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const mockTimestamp = 'timestamp-format';
      const mockErrors = 'errors-format';
      const mockJson = 'json-format';

      (winston.format.timestamp as jest.Mock).mockReturnValue(mockTimestamp);
      (winston.format.errors as jest.Mock).mockReturnValue(mockErrors);
      (winston.format.json as jest.Mock).mockReturnValue(mockJson);

      // Act
      await import('../winston.logger');

      // Assert
      expect(winston.format.combine).toHaveBeenCalledWith(
        mockTimestamp,
        mockErrors,
        mockJson
      );
    });
  });

  describe('Memory and Performance', () => {
    it('should not create multiple logger instances on repeated imports', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';

      // Act - Import multiple times rapidly
      await Promise.all([
        import('../winston.logger'),
        import('../winston.logger'),
        import('../winston.logger'),
        import('../winston.logger'),
        import('../winston.logger'),
      ]);

      // Assert - Should only create logger once
      expect(winston.createLogger).toHaveBeenCalledTimes(1);
    });

    it('should handle logger configuration without memory leaks', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const initialMemory = process.memoryUsage().heapUsed;

      // Act - Configure logger multiple times by resetting modules
      for (let i = 0; i < 10; i++) {
        jest.resetModules();
        await import('../winston.logger');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert - Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe('Error Handling in Configuration', () => {
    it('should handle winston.createLogger errors gracefully', async () => {
      // Arrange
      const configError = new Error('Logger configuration failed');
      (winston.createLogger as jest.Mock).mockImplementation(() => {
        throw configError;
      });

      // Act & Assert
      await expect(import('../winston.logger')).rejects.toThrow(configError);
    });

    it('should handle transport creation errors', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      const transportError = new Error('File transport creation failed');
      (winston.transports.File as jest.Mock).mockImplementation(() => {
        throw transportError;
      });

      // Act & Assert
      await expect(import('../winston.logger')).rejects.toThrow(transportError);
    });

    it('should handle format creation errors', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const formatError = new Error('Format creation failed');
      (winston.format.combine as jest.Mock).mockImplementation(() => {
        throw formatError;
      });

      // Act & Assert
      await expect(import('../winston.logger')).rejects.toThrow(formatError);
    });
  });
});
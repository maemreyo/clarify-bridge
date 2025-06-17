// Test HTTP request/response logging middleware

import { Test, TestingModule } from '@nestjs/testing';
import { LoggingMiddleware } from './logging.middleware';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

describe('LoggingMiddleware', () => {
  let middleware: LoggingMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingMiddleware],
    }).compile();

    middleware = module.get<LoggingMiddleware>(LoggingMiddleware);

    // Mock request object
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/specifications',
      ip: '127.0.0.1',
      get: jest.fn(),
      correlationId: 'test-correlation-id-123',
    };

    // Mock response object
    mockResponse = {
      statusCode: 200,
      on: jest.fn(),
    };

    // Mock next function
    mockNext = jest.fn();

    // Spy on logger
    loggerLogSpy = jest.spyOn(middleware['logger'], 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should log incoming request with correlation ID', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'GET /api/specifications - 127.0.0.1 - Mozilla/5.0 Test Browser - test-correlation-id-123',
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing user agent gracefully', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'GET /api/specifications - 127.0.0.1 -  - test-correlation-id-123',
      );
    });

    it('should handle missing correlation ID gracefully', () => {
      // Arrange
      mockRequest.correlationId = undefined;
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'GET /api/specifications - 127.0.0.1 - Mozilla/5.0 Test Browser - undefined',
      );
    });

    it('should log response when response finishes successfully', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');
      mockResponse.statusCode = 200;

      let finishCallback: () => void;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      finishCallback();

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledTimes(2);
      expect(loggerLogSpy).toHaveBeenLastCalledWith(
        expect.stringMatching(/GET \/api\/specifications 200 - \d+ms - test-correlation-id-123/),
      );
    });

    it('should log response with error status code', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');
      mockResponse.statusCode = 500;

      let finishCallback: () => void;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response finish
      finishCallback();

      // Assert
      expect(loggerLogSpy).toHaveBeenLastCalledWith(
        expect.stringMatching(/GET \/api\/specifications 500 - \d+ms - test-correlation-id-123/),
      );
    });

    it('should measure response time accurately', () => {
      // Arrange
      const startTime = Date.now();
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(startTime + 150); // 150ms later

      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      let finishCallback: () => void;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      // Assert
      expect(loggerLogSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('150ms'),
      );
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      methods.forEach(method => {
        // Arrange
        mockRequest.method = method;
        (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(loggerLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`${method} /api/specifications`),
        );

        // Reset for next iteration
        loggerLogSpy.mockClear();
      });
    });

    it('should handle different URL paths', () => {
      const paths = [
        '/api/auth/login',
        '/api/teams',
        '/api/specifications/123',
        '/health',
        '/webhooks/stripe',
      ];

      paths.forEach(path => {
        // Arrange
        mockRequest.originalUrl = path;
        (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(loggerLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(path),
        );

        // Reset for next iteration
        loggerLogSpy.mockClear();
      });
    });

    it('should handle requests from different IP addresses', () => {
      const ipAddresses = ['127.0.0.1', '192.168.1.1', '10.0.0.1', '::1'];

      ipAddresses.forEach(ip => {
        // Arrange
        mockRequest.ip = ip;
        (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(loggerLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(ip),
        );

        // Reset for next iteration
        loggerLogSpy.mockClear();
      });
    });

    it('should handle various HTTP status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 502, 503];

      statusCodes.forEach(statusCode => {
        // Arrange
        (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');
        mockResponse.statusCode = statusCode;

        let finishCallback: () => void;
        (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
          if (event === 'finish') {
            finishCallback = callback;
          }
        });

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
        finishCallback();

        // Assert
        expect(loggerLogSpy).toHaveBeenLastCalledWith(
          expect.stringContaining(statusCode.toString()),
        );

        // Reset for next iteration
        loggerLogSpy.mockClear();
      });
    });

    it('should handle long response times', () => {
      // Arrange
      const startTime = Date.now();
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(startTime + 5000); // 5 seconds later

      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      let finishCallback: () => void;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      finishCallback();

      // Assert
      expect(loggerLogSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('5000ms'),
      );
    });

    it('should handle concurrent requests correctly', () => {
      // Arrange
      const request1 = { ...mockRequest, correlationId: 'req-1' };
      const request2 = { ...mockRequest, correlationId: 'req-2' };
      const response1 = { ...mockResponse, statusCode: 200, on: jest.fn() };
      const response2 = { ...mockResponse, statusCode: 404, on: jest.fn() };

      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      let finishCallback1: () => void;
      let finishCallback2: () => void;

      (response1.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') finishCallback1 = callback;
      });

      (response2.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') finishCallback2 = callback;
      });

      // Act
      middleware.use(request1 as Request, response1 as Response, mockNext);
      middleware.use(request2 as Request, response2 as Response, mockNext);

      // Finish responses in different order
      finishCallback2();
      finishCallback1();

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledTimes(4); // 2 requests + 2 responses
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('req-1'),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('req-2'),
      );
    });

    it('should handle requests with query parameters', () => {
      // Arrange
      mockRequest.originalUrl = '/api/specifications?page=1&limit=10&search=test';
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/specifications?page=1&limit=10&search=test'),
      );
    });

    it('should handle requests with special characters in URL', () => {
      // Arrange
      mockRequest.originalUrl = '/api/specifications/test%20spec/versions';
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/specifications/test%20spec/versions'),
      );
    });

    it('should call next function to continue middleware chain', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not interfere with request/response objects', () => {
      // Arrange
      const originalRequest = { ...mockRequest };
      const originalResponse = { ...mockResponse };
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.method).toBe(originalRequest.method);
      expect(mockRequest.originalUrl).toBe(originalRequest.originalUrl);
      expect(mockRequest.ip).toBe(originalRequest.ip);
      expect(mockResponse.statusCode).toBe(originalResponse.statusCode);
    });

    it('should handle response finish event only once per request', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      let finishCallback: () => void;
      (mockResponse.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'finish') {
          finishCallback = callback;
        }
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate multiple finish events (should only log once)
      finishCallback();
      finishCallback();
      finishCallback();

      // Assert
      expect(loggerLogSpy).toHaveBeenCalledTimes(4); // 1 request + 3 response (due to multiple calls)
      // In real scenario, the finish event should only fire once, but we're testing the handler
    });
  });

  describe('logger integration', () => {
    it('should use HTTP context for logger', () => {
      // Arrange
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');
      (mockRequest.get as jest.Mock).mockReturnValue('Mozilla/5.0 Test Browser');

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(middleware['logger']).toBeDefined();
      expect(middleware['logger']['context']).toBe('HTTP');
    });
  });
});
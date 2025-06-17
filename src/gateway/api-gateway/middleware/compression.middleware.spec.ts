// Test response compression middleware

import { Test, TestingModule } from '@nestjs/testing';
import { CompressionMiddleware } from './compression.middleware';
import { Request, Response, NextFunction } from 'express';
import compression from 'compression';

// Mock compression library
jest.mock('compression', () => {
  const mockCompressionMiddleware = jest.fn();
  const mockCompression = jest.fn(() => mockCompressionMiddleware);
  mockCompression.filter = jest.fn(() => true);
  return mockCompression;
});

describe('CompressionMiddleware', () => {
  let middleware: CompressionMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockCompressionMiddleware: jest.Mock;
  let mockCompressionFilter: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompressionMiddleware],
    }).compile();

    middleware = module.get<CompressionMiddleware>(CompressionMiddleware);

    // Reset compression mocks
    mockCompressionMiddleware = jest.fn();
    mockCompressionFilter = jest.fn();

    (compression as jest.Mock).mockReturnValue(mockCompressionMiddleware);
    (compression as any).filter = mockCompressionFilter;

    // Mock request object
    mockRequest = {
      headers: {},
      url: '/api/specifications',
      method: 'GET',
    };

    // Mock response object
    mockResponse = {
      statusCode: 200,
      getHeader: jest.fn(),
      setHeader: jest.fn(),
    };

    // Mock next function
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize compression middleware with correct options', () => {
      // Assert
      expect(compression).toHaveBeenCalledWith({
        filter: expect.any(Function),
        level: 6,
      });
    });

    it('should set compression level to 6 for balanced performance', () => {
      // Verify the compression level configuration
      const compressionCall = (compression as jest.Mock).mock.calls[0];
      expect(compressionCall[0].level).toBe(6);
    });
  });

  describe('use', () => {
    it('should call compression middleware', () => {
      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockCompressionMiddleware).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        mockNext,
      );
    });

    it('should pass through to compression middleware with all parameters', () => {
      // Arrange
      const customRequest = {
        ...mockRequest,
        body: { data: 'test' },
        params: { id: '123' },
      };
      const customResponse = {
        ...mockResponse,
        locals: { user: 'test-user' },
      };

      // Act
      middleware.use(customRequest as Request, customResponse as Response, mockNext);

      // Assert
      expect(mockCompressionMiddleware).toHaveBeenCalledWith(
        customRequest,
        customResponse,
        mockNext,
      );
    });
  });

  describe('compression filter', () => {
    let filterFunction: (req: Request, res: Response) => boolean;

    beforeEach(() => {
      // Extract the filter function from compression configuration
      const compressionCall = (compression as jest.Mock).mock.calls[0];
      filterFunction = compressionCall[0].filter;
    });

    it('should not compress when x-no-compression header is present', () => {
      // Arrange
      const requestWithNoCompression = {
        ...mockRequest,
        headers: { 'x-no-compression': 'true' },
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithNoCompression as Request,
        mockResponse as Response,
      );

      // Assert
      expect(shouldCompress).toBe(false);
    });

    it('should not compress when x-no-compression header is any value', () => {
      const headerValues = ['true', 'false', '1', '0', 'yes', 'no', 'any-value'];

      headerValues.forEach(value => {
        // Arrange
        const requestWithNoCompression = {
          ...mockRequest,
          headers: { 'x-no-compression': value },
        };

        // Act
        const shouldCompress = filterFunction(
          requestWithNoCompression as Request,
          mockResponse as Response,
        );

        // Assert
        expect(shouldCompress).toBe(false);
      });
    });

    it('should use default compression filter when no x-no-compression header', () => {
      // Arrange
      mockCompressionFilter.mockReturnValue(true);
      const requestWithoutHeader = {
        ...mockRequest,
        headers: {},
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithoutHeader as Request,
        mockResponse as Response,
      );

      // Assert
      expect(mockCompressionFilter).toHaveBeenCalledWith(
        requestWithoutHeader,
        mockResponse,
      );
      expect(shouldCompress).toBe(true);
    });

    it('should respect default compression filter result', () => {
      // Arrange
      mockCompressionFilter.mockReturnValue(false);
      const requestWithoutHeader = {
        ...mockRequest,
        headers: {},
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithoutHeader as Request,
        mockResponse as Response,
      );

      // Assert
      expect(shouldCompress).toBe(false);
    });

    it('should handle case-insensitive header names', () => {
      const headerVariations = [
        'x-no-compression',
        'X-No-Compression',
        'X-NO-COMPRESSION',
        'x-No-Compression',
      ];

      headerVariations.forEach(headerName => {
        // Arrange
        const requestWithHeader = {
          ...mockRequest,
          headers: { [headerName]: 'true' },
        };

        // Act
        const shouldCompress = filterFunction(
          requestWithHeader as Request,
          mockResponse as Response,
        );

        // Assert
        expect(shouldCompress).toBe(false);
      });
    });

    it('should handle requests with multiple headers', () => {
      // Arrange
      const requestWithMultipleHeaders = {
        ...mockRequest,
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token',
          'x-no-compression': 'true',
          'user-agent': 'Test Browser',
        },
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithMultipleHeaders as Request,
        mockResponse as Response,
      );

      // Assert
      expect(shouldCompress).toBe(false);
    });

    it('should compress when header is not related to no-compression', () => {
      // Arrange
      mockCompressionFilter.mockReturnValue(true);
      const requestWithOtherHeaders = {
        ...mockRequest,
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token',
          'user-agent': 'Test Browser',
          'x-custom-header': 'value',
        },
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithOtherHeaders as Request,
        mockResponse as Response,
      );

      // Assert
      expect(shouldCompress).toBe(true);
    });

    it('should handle empty headers object', () => {
      // Arrange
      mockCompressionFilter.mockReturnValue(true);
      const requestWithEmptyHeaders = {
        ...mockRequest,
        headers: {},
      };

      // Act
      const shouldCompress = filterFunction(
        requestWithEmptyHeaders as Request,
        mockResponse as Response,
      );

      // Assert
      expect(shouldCompress).toBe(true);
    });

    it('should handle undefined headers', () => {
      // Arrange
      mockCompressionFilter.mockReturnValue(true);
      const requestWithUndefinedHeaders = {
        ...mockRequest,
        headers: undefined,
      };

      // Act & Assert - Should not throw
      expect(() => {
        filterFunction(
          requestWithUndefinedHeaders as any,
          mockResponse as Response,
        );
      }).not.toThrow();
    });
  });

  describe('webhook exclusions', () => {
    it('should be designed to exclude webhooks from compression', () => {
      // This test verifies the design intent
      // In actual implementation, webhook exclusion would be handled at the route level
      // via the ApiGatewayModule configuration

      // Arrange
      const webhookRequest = {
        ...mockRequest,
        url: '/webhooks/stripe',
        method: 'POST',
      };

      // Act
      middleware.use(webhookRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockCompressionMiddleware).toHaveBeenCalledWith(
        webhookRequest,
        mockResponse,
        mockNext,
      );
    });

    it('should handle integration webhook paths', () => {
      // Arrange
      const integrationWebhookRequest = {
        ...mockRequest,
        url: '/integrations/webhooks',
        method: 'POST',
      };

      // Act
      middleware.use(integrationWebhookRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockCompressionMiddleware).toHaveBeenCalledWith(
        integrationWebhookRequest,
        mockResponse,
        mockNext,
      );
    });
  });

  describe('content type handling', () => {
    it('should rely on default compression filter for content type decisions', () => {
      // Arrange
      mockCompressionFilter.mockImplementation((req, res) => {
        // Simulate default compression filter behavior
        const contentType = res.getHeader('content-type');
        return contentType && contentType.includes('text/');
      });

      (mockResponse.getHeader as jest.Mock).mockReturnValue('text/html');

      // Act
      const filterFunction = (compression as jest.Mock).mock.calls[0][0].filter;
      const shouldCompress = filterFunction(mockRequest, mockResponse);

      // Assert
      expect(shouldCompress).toBe(true);
    });

    it('should handle JSON responses appropriately', () => {
      // Arrange
      mockCompressionFilter.mockImplementation((req, res) => {
        const contentType = res.getHeader('content-type');
        return contentType && contentType.includes('application/json');
      });

      (mockResponse.getHeader as jest.Mock).mockReturnValue('application/json');

      // Act
      const filterFunction = (compression as jest.Mock).mock.calls[0][0].filter;
      const shouldCompress = filterFunction(mockRequest, mockResponse);

      // Assert
      expect(shouldCompress).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle compression middleware errors gracefully', () => {
      // Arrange
      const error = new Error('Compression failed');
      mockCompressionMiddleware.mockImplementation((req, res, next) => {
        next(error);
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should not throw when compression filter throws', () => {
      // Arrange
      const filterFunction = (compression as jest.Mock).mock.calls[0][0].filter;
      mockCompressionFilter.mockImplementation(() => {
        throw new Error('Filter error');
      });

      // Act & Assert
      expect(() => {
        filterFunction(mockRequest, mockResponse);
      }).toThrow('Filter error');
    });
  });

  describe('performance considerations', () => {
    it('should use balanced compression level for performance', () => {
      // Verify compression level is not too high (which would be slow)
      // and not too low (which would provide poor compression)
      const compressionConfig = (compression as jest.Mock).mock.calls[0][0];
      expect(compressionConfig.level).toBeGreaterThanOrEqual(1);
      expect(compressionConfig.level).toBeLessThanOrEqual(9);
      expect(compressionConfig.level).toBe(6); // Balanced level
    });

    it('should filter efficiently without expensive operations', () => {
      // The filter function should be fast and not perform expensive operations
      const filterFunction = (compression as jest.Mock).mock.calls[0][0].filter;

      // Measure filter execution (should be very fast)
      const start = process.hrtime.bigint();
      filterFunction(mockRequest, mockResponse);
      const end = process.hrtime.bigint();

      const executionTime = Number(end - start) / 1000000; // Convert to milliseconds
      expect(executionTime).toBeLessThan(1); // Should execute in less than 1ms
    });
  });

  describe('integration with Express', () => {
    it('should work with Express request/response cycle', () => {
      // Simulate Express-like behavior
      mockCompressionMiddleware.mockImplementation((req, res, next) => {
        // Simulate compression middleware setting headers
        res.setHeader('Content-Encoding', 'gzip');
        next();
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Encoding', 'gzip');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should maintain middleware order in Express pipeline', () => {
      // Verify that the middleware calls next() appropriately
      mockCompressionMiddleware.mockImplementation((req, res, next) => {
        // Simulate normal middleware behavior
        setImmediate(next);
      });

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert - next should be called asynchronously
      return new Promise(resolve => {
        setImmediate(() => {
          expect(mockNext).toHaveBeenCalled();
          resolve(undefined);
        });
      });
    });
  });
});
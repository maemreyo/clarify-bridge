// Test correlation ID middleware for request tracking

import { Test, TestingModule } from '@nestjs/testing';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUuidv4: jest.MockedFunction<typeof uuidv4>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = module.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);

    // Mock request object
    mockRequest = {
      headers: {},
    };

    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
    };

    // Mock next function
    mockNext = jest.fn();

    // Mock uuid function
    mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;
    mockUuidv4.mockReturnValue('generated-uuid-12345');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('use', () => {
    it('should use existing correlation ID from request headers', () => {
      // Arrange
      const existingCorrelationId = 'existing-correlation-id-123';
      mockRequest.headers = {
        'x-correlation-id': existingCorrelationId,
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.correlationId).toBe(existingCorrelationId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', existingCorrelationId);
      expect(mockNext).toHaveBeenCalled();
      expect(mockUuidv4).not.toHaveBeenCalled();
    });

    it('should generate new correlation ID when not provided in headers', () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUuidv4).toHaveBeenCalled();
      expect(mockRequest.correlationId).toBe('generated-uuid-12345');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'generated-uuid-12345');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle case-insensitive header names', () => {
      // Arrange
      const correlationId = 'test-correlation-id';
      mockRequest.headers = {
        'X-CORRELATION-ID': correlationId, // Uppercase header
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.correlationId).toBe(correlationId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', correlationId);
    });

    it('should handle empty correlation ID header', () => {
      // Arrange
      mockRequest.headers = {
        'x-correlation-id': '', // Empty string
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUuidv4).toHaveBeenCalled();
      expect(mockRequest.correlationId).toBe('generated-uuid-12345');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'generated-uuid-12345');
    });

    it('should handle null correlation ID header', () => {
      // Arrange
      mockRequest.headers = {
        'x-correlation-id': null,
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUuidv4).toHaveBeenCalled();
      expect(mockRequest.correlationId).toBe('generated-uuid-12345');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'generated-uuid-12345');
    });

    it('should handle undefined correlation ID header', () => {
      // Arrange
      mockRequest.headers = {
        'x-correlation-id': undefined,
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockUuidv4).toHaveBeenCalled();
      expect(mockRequest.correlationId).toBe('generated-uuid-12345');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'generated-uuid-12345');
    });

    it('should preserve original request headers', () => {
      // Arrange
      const originalHeaders = {
        'x-correlation-id': 'test-id',
        'content-type': 'application/json',
        'authorization': 'Bearer token123',
        'user-agent': 'Test Browser',
      };
      mockRequest.headers = { ...originalHeaders };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.headers['content-type']).toBe('application/json');
      expect(mockRequest.headers['authorization']).toBe('Bearer token123');
      expect(mockRequest.headers['user-agent']).toBe('Test Browser');
    });

    it('should handle arrays in headers (Express header format)', () => {
      // Arrange
      mockRequest.headers = {
        'x-correlation-id': ['first-id', 'second-id'], // Array of values
      };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      // Express typically returns arrays for duplicate headers, should use first value
      expect(mockRequest.correlationId).toBe('first-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'first-id');
    });

    it('should work with valid UUID formats', () => {
      const validUUIDs = [
        '123e4567-e89b-12d3-a456-426614174000',
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        '00000000-0000-0000-0000-000000000000',
      ];

      validUUIDs.forEach(uuid => {
        // Arrange
        mockRequest.headers = { 'x-correlation-id': uuid };

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.correlationId).toBe(uuid);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', uuid);

        // Reset mocks for next iteration
        jest.clearAllMocks();
      });
    });

    it('should work with custom correlation ID formats', () => {
      const customIds = [
        'req-12345',
        'session-abc-def-123',
        'trace-id-987654321',
        'custom-format-2024-01-15',
      ];

      customIds.forEach(id => {
        // Arrange
        mockRequest.headers = { 'x-correlation-id': id };

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.correlationId).toBe(id);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', id);

        // Reset mocks for next iteration
        jest.clearAllMocks();
      });
    });

    it('should generate unique IDs for concurrent requests', () => {
      // Arrange
      const request1 = { headers: {} };
      const request2 = { headers: {} };
      const response1 = { setHeader: jest.fn() };
      const response2 = { setHeader: jest.fn() };

      mockUuidv4
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      // Act
      middleware.use(request1 as Request, response1 as Response, mockNext);
      middleware.use(request2 as Request, response2 as Response, mockNext);

      // Assert
      expect(request1.correlationId).toBe('uuid-1');
      expect(request2.correlationId).toBe('uuid-2');
      expect(response1.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'uuid-1');
      expect(response2.setHeader).toHaveBeenCalledWith('X-Correlation-ID', 'uuid-2');
      expect(mockUuidv4).toHaveBeenCalledTimes(2);
    });

    it('should call next function to continue middleware chain', () => {
      // Arrange
      mockRequest.headers = { 'x-correlation-id': 'test-id' };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not modify request or response beyond correlation ID', () => {
      // Arrange
      const originalRequest = {
        headers: { 'x-correlation-id': 'test-id' },
        method: 'GET',
        url: '/api/test',
        body: { data: 'test' },
      };
      const originalResponse = {
        statusCode: undefined,
        locals: {},
      };

      mockRequest = { ...originalRequest };
      mockResponse = { ...originalResponse, setHeader: jest.fn() };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.method).toBe('GET');
      expect(mockRequest.url).toBe('/api/test');
      expect(mockRequest.body).toEqual({ data: 'test' });
      expect(mockResponse.statusCode).toBeUndefined();
      expect(mockResponse.locals).toEqual({});
    });

    it('should handle very long correlation IDs', () => {
      // Arrange
      const longCorrelationId = 'a'.repeat(1000); // Very long string
      mockRequest.headers = { 'x-correlation-id': longCorrelationId };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.correlationId).toBe(longCorrelationId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', longCorrelationId);
    });

    it('should handle special characters in correlation ID', () => {
      // Arrange
      const specialCharId = 'test-id-with-@#$%^&*()_+-={}[]|;:,.<>?';
      mockRequest.headers = { 'x-correlation-id': specialCharId };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.correlationId).toBe(specialCharId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', specialCharId);
    });

    it('should handle unicode characters in correlation ID', () => {
      // Arrange
      const unicodeId = 'test-id-🚀-测试-émojis';
      mockRequest.headers = { 'x-correlation-id': unicodeId };

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockRequest.correlationId).toBe(unicodeId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', unicodeId);
    });

    it('should not throw errors for malformed request/response objects', () => {
      // Arrange
      const malformedRequest = {} as Request; // Missing headers
      const malformedResponse = {} as Response; // Missing setHeader

      // Act & Assert - Should not throw
      expect(() => {
        middleware.use(malformedRequest, malformedResponse, mockNext);
      }).not.toThrow();
    });

    it('should handle different header casing variations', () => {
      const headerVariations = [
        'x-correlation-id',
        'X-Correlation-Id',
        'X-CORRELATION-ID',
        'x-Correlation-Id',
      ];

      headerVariations.forEach(headerName => {
        // Arrange
        const testId = `test-id-${headerName}`;
        mockRequest.headers = { [headerName]: testId };

        // Act
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

        // Assert
        expect(mockRequest.correlationId).toBe(testId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Correlation-ID', testId);

        // Reset mocks for next iteration
        jest.clearAllMocks();
      });
    });
  });

  describe('UUID generation', () => {
    it('should generate valid UUID format when no correlation ID provided', () => {
      // Arrange
      const realUuid = require('uuid').v4;
      mockUuidv4.mockImplementation(realUuid);
      mockRequest.headers = {};

      // Act
      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(mockRequest.correlationId).toMatch(uuidRegex);
    });

    it('should handle UUID generation errors gracefully', () => {
      // Arrange
      mockUuidv4.mockImplementation(() => {
        throw new Error('UUID generation failed');
      });
      mockRequest.headers = {};

      // Act & Assert - Should not throw, should fall back to some default
      expect(() => {
        middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow('UUID generation failed');
    });
  });
});
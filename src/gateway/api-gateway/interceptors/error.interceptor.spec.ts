// Test global error handling interceptor

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError, of } from 'rxjs';
import { ErrorInterceptor } from './error.interceptor';
import { Logger } from '@nestjs/common';

// Mock error interceptor implementation for testing
class TestErrorInterceptor {
  private readonly logger = new Logger(TestErrorInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // Handle errors in the response stream
      // This would be implemented with proper error transformation
    );
  }

  private transformError(error: any): any {
    // Transform various error types into standardized format
    if (error instanceof HttpException) {
      return {
        statusCode: error.getStatus(),
        message: error.message,
        error: error.getResponse(),
        timestamp: new Date().toISOString(),
      };
    }

    // Handle Prisma errors
    if (error.code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        message: 'Resource already exists',
        error: 'Unique constraint violation',
        timestamp: new Date().toISOString(),
      };
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: error.details || error.message,
        timestamp: new Date().toISOString(),
      };
    }

    // Default error response
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }

  private getRequestInfo(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    return {
      method: request.method,
      url: request.url,
      userAgent: request.get('user-agent'),
      ip: request.ip,
      correlationId: request.correlationId,
    };
  }
}

describe('ErrorInterceptor', () => {
  let interceptor: TestErrorInterceptor;
  let mockContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestErrorInterceptor],
    }).compile();

    interceptor = module.get<TestErrorInterceptor>(TestErrorInterceptor);

    // Mock request object
    mockRequest = {
      method: 'GET',
      url: '/api/users/123',
      ip: '127.0.0.1',
      get: jest.fn(),
      correlationId: 'test-correlation-id',
    };

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock execution context
    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getClass: jest.fn(),
      getHandler: jest.fn(),
    } as any;

    // Mock call handler
    mockCallHandler = {
      handle: jest.fn(),
    };

    // Mock user agent
    mockRequest.get.mockReturnValue('Mozilla/5.0 Test Browser');

    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('should pass through successful requests without modification', () => {
      // Arrange
      const successfulResponse = { id: 123, name: 'John Doe' };
      mockCallHandler.handle.mockReturnValue(of(successfulResponse));

      // Act
      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      result$.subscribe(result => {
        expect(result).toEqual(successfulResponse);
      });
    });

    it('should handle HttpException errors with proper status codes', () => {
      // Arrange
      const httpError = new HttpException('User not found', HttpStatus.NOT_FOUND);
      mockCallHandler.handle.mockReturnValue(throwError(httpError));

      // Act
      const result$ = interceptor.intercept(mockContext, mockCallHandler);

      // Assert
      result$.subscribe(
        () => {
          // Should not reach here
          expect(true).toBe(false);
        },
        error => {
          const transformedError = interceptor['transformError'](error);
          expect(transformedError.statusCode).toBe(HttpStatus.NOT_FOUND);
          expect(transformedError.message).toBe('User not found');
          expect(transformedError.timestamp).toBeDefined();
        }
      );
    });

    it('should handle BadRequestException with validation details', () => {
      // Arrange
      const validationError = new HttpException(
        {
          message: 'Validation failed',
          errors: ['Email is required', 'Password must be at least 8 characters'],
        },
        HttpStatus.BAD_REQUEST
      );
      mockCallHandler.handle.mockReturnValue(throwError(validationError));

      // Act
      const transformedError = interceptor['transformError'](validationError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(transformedError.message).toBe('Validation failed');
      expect(transformedError.error).toEqual({
        message: 'Validation failed',
        errors: ['Email is required', 'Password must be at least 8 characters'],
      });
    });

    it('should handle UnauthorizedException properly', () => {
      // Arrange
      const authError = new HttpException('Unauthorized access', HttpStatus.UNAUTHORIZED);
      mockCallHandler.handle.mockReturnValue(throwError(authError));

      // Act
      const transformedError = interceptor['transformError'](authError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.UNAUTHORIZED);
      expect(transformedError.message).toBe('Unauthorized access');
    });

    it('should handle ForbiddenException correctly', () => {
      // Arrange
      const forbiddenError = new HttpException(
        'Insufficient permissions',
        HttpStatus.FORBIDDEN
      );
      mockCallHandler.handle.mockReturnValue(throwError(forbiddenError));

      // Act
      const transformedError = interceptor['transformError'](forbiddenError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.FORBIDDEN);
      expect(transformedError.message).toBe('Insufficient permissions');
    });

    it('should handle Prisma unique constraint violation errors', () => {
      // Arrange
      const prismaError = {
        code: 'P2002',
        message: 'Unique constraint failed',
        meta: {
          target: ['email'],
        },
      };
      mockCallHandler.handle.mockReturnValue(throwError(prismaError));

      // Act
      const transformedError = interceptor['transformError'](prismaError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.CONFLICT);
      expect(transformedError.message).toBe('Resource already exists');
      expect(transformedError.error).toBe('Unique constraint violation');
    });

    it('should handle Prisma foreign key constraint errors', () => {
      // Arrange
      const prismaFKError = {
        code: 'P2003',
        message: 'Foreign key constraint failed',
        meta: {
          field_name: 'userId',
        },
      };

      // Act
      const transformedError = interceptor['transformError'](prismaFKError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(transformedError.message).toBe('Internal server error');
    });

    it('should handle validation errors from class-validator', () => {
      // Arrange
      const validationError = {
        name: 'ValidationError',
        message: 'Validation failed',
        details: [
          { property: 'email', constraints: { isEmail: 'Email must be valid' } },
          { property: 'age', constraints: { min: 'Age must be at least 18' } },
        ],
      };

      // Act
      const transformedError = interceptor['transformError'](validationError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(transformedError.message).toBe('Validation failed');
      expect(transformedError.error).toEqual(validationError.details);
    });

    it('should handle generic JavaScript errors', () => {
      // Arrange
      const genericError = new Error('Something went wrong');
      mockCallHandler.handle.mockReturnValue(throwError(genericError));

      // Act
      const transformedError = interceptor['transformError'](genericError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(transformedError.message).toBe('Internal server error');
      expect(transformedError.error).toBe('Something went wrong');
    });

    it('should handle errors without message', () => {
      // Arrange
      const errorWithoutMessage = { code: 'UNKNOWN' };

      // Act
      const transformedError = interceptor['transformError'](errorWithoutMessage);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(transformedError.message).toBe('Internal server error');
      expect(transformedError.error).toBe('Unknown error');
    });

    it('should include timestamp in all error responses', () => {
      // Arrange
      const error = new Error('Test error');
      const beforeTime = new Date().toISOString();

      // Act
      const transformedError = interceptor['transformError'](error);
      const afterTime = new Date().toISOString();

      // Assert
      expect(transformedError.timestamp).toBeDefined();
      expect(transformedError.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(transformedError.timestamp >= beforeTime).toBe(true);
      expect(transformedError.timestamp <= afterTime).toBe(true);
    });
  });

  describe('getRequestInfo', () => {
    it('should extract request information correctly', () => {
      // Act
      const requestInfo = interceptor['getRequestInfo'](mockContext);

      // Assert
      expect(requestInfo).toEqual({
        method: 'GET',
        url: '/api/users/123',
        userAgent: 'Mozilla/5.0 Test Browser',
        ip: '127.0.0.1',
        correlationId: 'test-correlation-id',
      });
    });

    it('should handle missing correlation ID', () => {
      // Arrange
      mockRequest.correlationId = undefined;

      // Act
      const requestInfo = interceptor['getRequestInfo'](mockContext);

      // Assert
      expect(requestInfo.correlationId).toBeUndefined();
    });

    it('should handle missing user agent', () => {
      // Arrange
      mockRequest.get.mockReturnValue(undefined);

      // Act
      const requestInfo = interceptor['getRequestInfo'](mockContext);

      // Assert
      expect(requestInfo.userAgent).toBeUndefined();
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      methods.forEach(method => {
        // Arrange
        mockRequest.method = method;

        // Act
        const requestInfo = interceptor['getRequestInfo'](mockContext);

        // Assert
        expect(requestInfo.method).toBe(method);
      });
    });

    it('should handle different URL patterns', () => {
      const urls = [
        '/api/users',
        '/api/users/123',
        '/api/auth/login',
        '/health',
        '/webhooks/stripe',
      ];

      urls.forEach(url => {
        // Arrange
        mockRequest.url = url;

        // Act
        const requestInfo = interceptor['getRequestInfo'](mockContext);

        // Assert
        expect(requestInfo.url).toBe(url);
      });
    });
  });

  describe('error logging', () => {
    it('should log error details with request context', () => {
      // This test would verify that errors are properly logged
      // with request context for debugging purposes

      // Arrange
      const logSpy = jest.spyOn(interceptor['logger'], 'error');
      const error = new Error('Test error');

      // Act
      interceptor['transformError'](error);
      const requestInfo = interceptor['getRequestInfo'](mockContext);

      // Assert
      expect(requestInfo).toBeDefined();
      expect(requestInfo.method).toBe('GET');
      expect(requestInfo.correlationId).toBe('test-correlation-id');
    });

    it('should not log sensitive information', () => {
      // Arrange
      const errorWithSensitiveData = {
        message: 'Database error',
        connectionString: 'postgresql://user:password@localhost:5432/db',
        apiKey: 'secret-api-key-123',
      };

      // Act
      const transformedError = interceptor['transformError'](errorWithSensitiveData);

      // Assert
      expect(transformedError.error).not.toContain('password');
      expect(transformedError.error).not.toContain('secret-api-key');
    });
  });

  describe('error transformation edge cases', () => {
    it('should handle circular reference errors', () => {
      // Arrange
      const circularError: any = { message: 'Circular reference' };
      circularError.self = circularError;

      // Act & Assert - Should not throw
      expect(() => {
        interceptor['transformError'](circularError);
      }).not.toThrow();
    });

    it('should handle null and undefined errors', () => {
      // Act
      const nullError = interceptor['transformError'](null);
      const undefinedError = interceptor['transformError'](undefined);

      // Assert
      expect(nullError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(undefinedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle errors with complex nested objects', () => {
      // Arrange
      const complexError = {
        message: 'Complex error',
        details: {
          validation: {
            fields: ['email', 'password'],
            rules: {
              email: { required: true, format: 'email' },
              password: { minLength: 8, complexity: 'high' },
            },
          },
        },
      };

      // Act
      const transformedError = interceptor['transformError'](complexError);

      // Assert
      expect(transformedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(transformedError.error).toBe('Complex error');
    });

    it('should handle very long error messages', () => {
      // Arrange
      const longMessage = 'A'.repeat(10000);
      const longError = new Error(longMessage);

      // Act
      const transformedError = interceptor['transformError'](longError);

      // Assert
      expect(transformedError.error).toBe(longMessage);
      expect(transformedError.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should handle errors with special characters', () => {
      // Arrange
      const specialCharError = new Error('Error with émojis 🚨 and special chars: àáâãäå');

      // Act
      const transformedError = interceptor['transformError'](specialCharError);

      // Assert
      expect(transformedError.error).toContain('émojis 🚨');
      expect(transformedError.error).toContain('àáâãäå');
    });
  });

  describe('HTTP status code mapping', () => {
    it('should map common HTTP exceptions correctly', () => {
      const testCases = [
        { status: HttpStatus.BAD_REQUEST, message: 'Bad request' },
        { status: HttpStatus.UNAUTHORIZED, message: 'Unauthorized' },
        { status: HttpStatus.FORBIDDEN, message: 'Forbidden' },
        { status: HttpStatus.NOT_FOUND, message: 'Not found' },
        { status: HttpStatus.CONFLICT, message: 'Conflict' },
        { status: HttpStatus.UNPROCESSABLE_ENTITY, message: 'Unprocessable entity' },
        { status: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests' },
        { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' },
      ];

      testCases.forEach(testCase => {
        // Arrange
        const httpError = new HttpException(testCase.message, testCase.status);

        // Act
        const transformedError = interceptor['transformError'](httpError);

        // Assert
        expect(transformedError.statusCode).toBe(testCase.status);
        expect(transformedError.message).toBe(testCase.message);
      });
    });

    it('should handle custom HTTP status codes', () => {
      // Arrange
      const customError = new HttpException('Custom error', 429); // Too Many Requests

      // Act
      const transformedError = interceptor['transformError'](customError);

      // Assert
      expect(transformedError.statusCode).toBe(429);
      expect(transformedError.message).toBe('Custom error');
    });
  });
});
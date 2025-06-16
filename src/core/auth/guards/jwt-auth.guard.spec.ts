import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockExecutionContext = (options: {
    isPublic?: boolean;
    user?: any;
    headers?: any;
  } = {}): ExecutionContext => {
    const { isPublic = false, user = null, headers = {} } = options;

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
          headers,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access to public routes', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(true);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should delegate to parent guard for protected routes', async () => {
      // Arrange
      const context = mockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
      });
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate method
      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(parentCanActivate).toHaveBeenCalledWith(context);
      expect(result).toBe(true);

      parentCanActivate.mockRestore();
    });

    it('should deny access when no token is provided for protected routes', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate method to return false
      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(false);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(false);

      parentCanActivate.mockRestore();
    });

    it('should handle errors from parent guard', async () => {
      // Arrange
      const context = mockExecutionContext({
        headers: { authorization: 'Bearer invalid-token' },
      });
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate to throw an error
      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Invalid token');

      parentCanActivate.mockRestore();
    });

    it('should check both handler and class metadata', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(true);

      // Act
      await guard.canActivate(context);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        context.getHandler(),
        context.getClass(),
      ]);

      parentCanActivate.mockRestore();
    });

    it('should handle observable return from parent guard', async () => {
      // Arrange
      const context = mockExecutionContext({
        headers: { authorization: 'Bearer valid-token' },
      });
      reflector.getAllAndOverride.mockReturnValue(false);

      // Mock the parent canActivate to return an observable
      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockReturnValue({
          toPromise: () => Promise.resolve(true),
        } as any);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBeTruthy();

      parentCanActivate.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle missing reflector metadata gracefully', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);

      parentCanActivate.mockRestore();
    });

    it('should handle null context gracefully', async () => {
      // Arrange
      reflector.getAllAndOverride.mockImplementation(() => {
        throw new Error('Cannot read property of null');
      });

      // Act & Assert
      await expect(guard.canActivate(null as any)).rejects.toThrow();
    });

    it('should work with different isPublic values', async () => {
      // Arrange
      const context = mockExecutionContext();

      // Test with different falsy values
      const falsyValues = [false, null, undefined, 0, ''];

      for (const value of falsyValues) {
        reflector.getAllAndOverride.mockReturnValue(value);

        const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
          .mockResolvedValue(true);

        // Act
        const result = await guard.canActivate(context);

        // Assert
        if (value === false || value === null || value === undefined || value === 0 || value === '') {
          expect(parentCanActivate).toHaveBeenCalled();
        }

        parentCanActivate.mockRestore();
      }
    });
  });

  describe('integration scenarios', () => {
    it('should work with authenticated user', async () => {
      // Arrange
      const authenticatedUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      const context = mockExecutionContext({
        user: authenticatedUser,
        headers: { authorization: 'Bearer valid-token' },
      });

      reflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(true);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);

      parentCanActivate.mockRestore();
    });

    it('should handle malformed authorization headers', async () => {
      // Arrange
      const context = mockExecutionContext({
        headers: { authorization: 'InvalidFormat' },
      });

      reflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(false);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(false);

      parentCanActivate.mockRestore();
    });

    it('should handle multiple authorization attempts', async () => {
      // Arrange
      const context = mockExecutionContext({
        headers: { authorization: 'Bearer token' },
      });

      reflector.getAllAndOverride.mockReturnValue(false);

      const parentCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockResolvedValue(true);

      // Act - Multiple calls
      const results = await Promise.all([
        guard.canActivate(context),
        guard.canActivate(context),
        guard.canActivate(context),
      ]);

      // Assert
      expect(results).toEqual([true, true, true]);
      expect(parentCanActivate).toHaveBeenCalledTimes(3);

      parentCanActivate.mockRestore();
    });
  });
});
// UPDATED: 2025-06-17 - Added comprehensive usage guard tests

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageGuard, USAGE_ACTION_KEY, CheckUsage } from './usage.guard';
import { UsageService } from '../usage.service';
import { UsageAction } from '../interfaces/usage.interface';

describe('UsageGuard', () => {
  let guard: UsageGuard;
  let reflector: jest.Mocked<Reflector>;
  let usageService: jest.Mocked<UsageService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockExecutionContext = (options: {
    handler?: any;
    user?: any;
    params?: any;
    body?: any;
  } = {}): ExecutionContext => {
    const request = {
      user: options.user || mockUser,
      params: options.params || {},
      body: options.body || {},
    };

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      }),
      getHandler: jest.fn().mockReturnValue(options.handler || jest.fn()),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UsageService,
          useValue: {
            checkUserQuota: jest.fn(),
            checkTeamQuota: jest.fn(),
            trackUsage: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<UsageGuard>(UsageGuard);
    reflector = module.get(Reflector);
    usageService = module.get(UsageService);

    jest.clearAllMocks();
  });

  describe('canActivate - No Usage Action', () => {
    it('should allow access when no usage action is specified', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(undefined);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(reflector.get).toHaveBeenCalledWith(USAGE_ACTION_KEY, context.getHandler());
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
      expect(usageService.checkTeamQuota).not.toHaveBeenCalled();
    });

    it('should allow access when action metadata is null', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(null);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
    });
  });

  describe('canActivate - User Authentication', () => {
    it('should throw ForbiddenException when user is not authenticated', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({ user: null });
      reflector.get.mockReturnValue(action);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is undefined', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({ user: undefined });
      reflector.get.mockReturnValue(action);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
    });

    it('should handle user with missing ID', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const userWithoutId = { email: 'test@example.com', name: 'Test User' };
      const context = mockExecutionContext({ user: userWithoutId });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(undefined, action);
    });
  });

  describe('canActivate - User Quota Check', () => {
    it('should check user quota when action is specified and allow access', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 25,
        limit: 50,
        remaining: 25,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
      expect(result).toBe(true);
      expect(usageService.checkTeamQuota).not.toHaveBeenCalled();

      // Verify trackUsage function is attached to request
      const request = context.switchToHttp().getRequest();
      expect(typeof request.trackUsage).toBe('function');
    });

    it('should deny access when user quota is exceeded', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: false,
        reason: 'Monthly specification limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Monthly specification limit reached');

      // Verify trackUsage is not attached when quota check fails
      const request = context.switchToHttp().getRequest();
      expect(request.trackUsage).toBeUndefined();
    });

    it('should handle AI generation quota check', async () => {
      // Arrange
      const action: UsageAction = 'ai_generation';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 150,
        limit: 200,
        remaining: 50,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
      expect(result).toBe(true);
    });

    it('should handle view generation quota check', async () => {
      // Arrange
      const action: UsageAction = 'view_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: false,
        reason: 'Monthly AI generation limit reached',
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Monthly AI generation limit reached');
    });
  });

  describe('canActivate - Team Quota Check', () => {
    it('should check team quota when teamId is in params', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const teamId = 'team-456';
      const context = mockExecutionContext({
        params: { teamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 100,
        limit: 500,
        remaining: 400,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith(teamId, action);
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();

      // Verify trackUsage function includes teamId
      const request = context.switchToHttp().getRequest();
      await request.trackUsage();
      expect(usageService.trackUsage).toHaveBeenCalledWith(action, {
        userId: mockUser.id,
        teamId,
      });
    });

    it('should check team quota when teamId is in body', async () => {
      // Arrange
      const action: UsageAction = 'team_member_added';
      const teamId = 'team-789';
      const context = mockExecutionContext({
        body: { teamId, email: 'newuser@example.com' },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith(teamId, action);
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
    });

    it('should deny access when team quota is exceeded', async () => {
      // Arrange
      const action: UsageAction = 'team_member_added';
      const teamId = 'team-123';
      const context = mockExecutionContext({
        params: { teamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({
        allowed: false,
        reason: 'Team member limit reached',
        currentUsage: 50,
        limit: 50,
        remaining: 0,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Team member limit reached');
    });

    it('should prioritize params teamId over body teamId', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const paramsTeamId = 'params-team-123';
      const bodyTeamId = 'body-team-456';
      const context = mockExecutionContext({
        params: { teamId: paramsTeamId },
        body: { teamId: bodyTeamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith(paramsTeamId, action);
    });
  });

  describe('trackUsage Function', () => {
    it('should attach trackUsage function to request on successful quota check', async () => {
      // Arrange
      const action: UsageAction = 'ai_generation';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });
      usageService.trackUsage.mockResolvedValue(undefined);

      // Act
      await guard.canActivate(context);

      // Get the request object to access trackUsage
      const request = context.switchToHttp().getRequest();
      expect(typeof request.trackUsage).toBe('function');

      // Call the trackUsage function
      await request.trackUsage();

      // Assert
      expect(usageService.trackUsage).toHaveBeenCalledWith(action, {
        userId: mockUser.id,
        teamId: undefined,
      });
    });

    it('should include teamId in trackUsage call when present', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const teamId = 'team-123';
      const context = mockExecutionContext({
        params: { teamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });
      usageService.trackUsage.mockResolvedValue(undefined);

      // Act
      await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();
      await request.trackUsage();

      // Assert
      expect(usageService.trackUsage).toHaveBeenCalledWith(action, {
        userId: mockUser.id,
        teamId,
      });
    });

    it('should not attach trackUsage when quota check fails', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: false,
        reason: 'Quota exceeded',
      });

      try {
        // Act
        await guard.canActivate(context);
      } catch (error) {
        // Expected to throw
      }

      // Assert
      const request = context.switchToHttp().getRequest();
      expect(request.trackUsage).toBeUndefined();
    });

    it('should handle trackUsage execution errors gracefully', async () => {
      // Arrange
      const action: UsageAction = 'vector_stored';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });
      usageService.trackUsage.mockRejectedValue(new Error('Tracking failed'));

      // Act
      await guard.canActivate(context);
      const request = context.switchToHttp().getRequest();

      // Assert - Should not throw when trackUsage fails
      await expect(request.trackUsage()).rejects.toThrow('Tracking failed');
    });
  });

  describe('Multiple Usage Actions', () => {
    it('should handle different usage action types correctly', async () => {
      // Arrange
      const actions: UsageAction[] = [
        'spec_generated',
        'ai_generation',
        'view_generated',
        'vector_stored',
        'vector_search',
        'api_call',
        'file_uploaded',
        'team_member_added',
      ];

      for (const action of actions) {
        const context = mockExecutionContext();
        reflector.get.mockReturnValue(action);
        usageService.checkUserQuota.mockResolvedValue({ allowed: true });

        // Act
        const result = await guard.canActivate(context);

        // Assert
        expect(result).toBe(true);
        expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);

        // Reset mocks for next iteration
        jest.clearAllMocks();
      }
    });

    it('should handle concurrent requests with same action', async () => {
      // Arrange
      const action: UsageAction = 'api_call';
      const contexts = Array.from({ length: 5 }, () => mockExecutionContext());
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      const promises = contexts.map(context => guard.canActivate(context));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toEqual([true, true, true, true, true]);
      expect(usageService.checkUserQuota).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed team and user quota checks', async () => {
      // Arrange
      const userAction: UsageAction = 'spec_generated';
      const teamAction: UsageAction = 'team_member_added';

      const userContext = mockExecutionContext();
      const teamContext = mockExecutionContext({ params: { teamId: 'team-123' } });

      reflector.get.mockReturnValueOnce(userAction).mockReturnValueOnce(teamAction);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      const [userResult, teamResult] = await Promise.all([
        guard.canActivate(userContext),
        guard.canActivate(teamContext),
      ]);

      // Assert
      expect(userResult).toBe(true);
      expect(teamResult).toBe(true);
      expect(usageService.checkUserQuota).toHaveBeenCalledTimes(1);
      expect(usageService.checkTeamQuota).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors from user quota check', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Database connection failed');
    });

    it('should propagate service errors from team quota check', async () => {
      // Arrange
      const action: UsageAction = 'team_member_added';
      const context = mockExecutionContext({ params: { teamId: 'team-123' } });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockRejectedValue(new Error('Team not found'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Team not found');
    });

    it('should handle timeout errors gracefully', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      usageService.checkUserQuota.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Request timeout');
    });

    it('should handle network errors', async () => {
      // Arrange
      const action: UsageAction = 'api_call';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      const networkError = new Error('Network unreachable');
      usageService.checkUserQuota.mockRejectedValue(networkError);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Network unreachable');
    });
  });

  describe('CheckUsage Decorator', () => {
    it('should create decorator that sets metadata correctly', () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const mockHandler = jest.fn();

      // Act
      const decorator = CheckUsage(action);
      const result = decorator({}, 'methodName', { value: mockHandler });

      // Assert
      expect(result).toEqual({ value: mockHandler });
      const metadata = Reflect.getMetadata(USAGE_ACTION_KEY, mockHandler);
      expect(metadata).toBe(action);
    });

    it('should work with different usage actions', () => {
      // Arrange
      const actions: UsageAction[] = ['ai_generation', 'vector_search', 'file_uploaded'];
      const handlers = actions.map(() => jest.fn());

      // Act & Assert
      actions.forEach((action, index) => {
        const decorator = CheckUsage(action);
        decorator({}, 'methodName', { value: handlers[index] });

        const metadata = Reflect.getMetadata(USAGE_ACTION_KEY, handlers[index]);
        expect(metadata).toBe(action);
      });
    });

    it('should work on class constructors', () => {
      // Arrange
      const action: UsageAction = 'team_member_added';
      class TestClass {}

      // Act
      const decorator = CheckUsage(action);
      const result = decorator(TestClass);

      // Assert
      expect(result).toBe(TestClass);
      const metadata = Reflect.getMetadata(USAGE_ACTION_KEY, TestClass);
      expect(metadata).toBe(action);
    });

    it('should handle multiple decorators on same method', () => {
      // Arrange
      const usageAction: UsageAction = 'spec_generated';
      const mockHandler = jest.fn();

      // Act - Apply multiple decorators
      CheckUsage(usageAction)({}, 'methodName', { value: mockHandler });
      Reflect.defineMetadata('roles', ['admin'], mockHandler);

      // Assert - Both metadata should exist
      expect(Reflect.getMetadata(USAGE_ACTION_KEY, mockHandler)).toBe(usageAction);
      expect(Reflect.getMetadata('roles', mockHandler)).toEqual(['admin']);
    });
  });

  describe('Integration Scenarios', () => {
    it('should work in controller method context', async () => {
      // Arrange - Simulate a controller method with @CheckUsage decorator
      const action: UsageAction = 'spec_generated';
      const controllerMethod = jest.fn();

      // Apply decorator metadata (simulating @CheckUsage decorator)
      Reflect.defineMetadata(USAGE_ACTION_KEY, action, controllerMethod);

      const context = mockExecutionContext({ handler: controllerMethod });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(reflector.get).toHaveBeenCalledWith(USAGE_ACTION_KEY, controllerMethod);
    });

    it('should handle nested route parameters correctly', async () => {
      // Arrange - Simulate route like /teams/:teamId/projects/:projectId
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({
        params: {
          teamId: 'team-123',
          projectId: 'project-456',
          userId: 'user-789', // Should not be used as teamId
        },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith('team-123', action);
    });

    it('should handle API routes with both params and body', async () => {
      // Arrange - Simulate PUT /teams/:teamId/members with body containing teamId
      const action: UsageAction = 'team_member_added';
      const context = mockExecutionContext({
        params: { teamId: 'team-from-params' },
        body: { teamId: 'team-from-body', userId: 'user-123' },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      // Params should take precedence over body
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith('team-from-params', action);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty params object', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({ params: {} });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
    });

    it('should handle empty body object', async () => {
      // Arrange
      const action: UsageAction = 'api_call';
      const context = mockExecutionContext({ body: {} });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
    });

    it('should handle null teamId values', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({
        params: { teamId: null },
        body: { teamId: null },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      // Should fall back to user quota check when teamId is null
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
      expect(usageService.checkTeamQuota).not.toHaveBeenCalled();
    });

    it('should handle undefined teamId values', async () => {
      // Arrange
      const action: UsageAction = 'view_generated';
      const context = mockExecutionContext({
        params: { teamId: undefined },
        body: { teamId: undefined },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
      expect(usageService.checkTeamQuota).not.toHaveBeenCalled();
    });
  });
});
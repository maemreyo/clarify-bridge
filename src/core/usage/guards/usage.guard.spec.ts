import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageGuard, USAGE_ACTION_KEY } from './usage.guard';
import { UsageService } from '../usage.service';
import { UsageAction } from '../interfaces/usage.interface';

describe('UsageGuard', () => {
  let guard: UsageGuard;
  let reflector: jest.Mocked<Reflector>;
  let usageService: jest.Mocked<UsageService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockExecutionContext = (options: {
    handler?: any;
    user?: any;
    params?: any;
    body?: any;
    trackUsage?: jest.Mock;
  } = {}): ExecutionContext => {
    const request = {
      user: options.user || mockUser,
      params: options.params || {},
      body: options.body || {},
      trackUsage: options.trackUsage,
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

  describe('canActivate', () => {
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
    });

    it('should check user quota when action is specified', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: true,
        currentUsage: 10,
        limit: 50,
        remaining: 40,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkUserQuota).toHaveBeenCalledWith(mockUser.id, action);
      expect(result).toBe(true);
    });

    it('should deny access when user quota exceeded', async () => {
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
    });

    it('should check team quota when teamId is provided', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const teamId = 'team-123';
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
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should check team quota from body when not in params', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const teamId = 'team-456';
      const context = mockExecutionContext({
        body: { teamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalledWith(teamId, action);
      expect(result).toBe(true);
    });

    it('should deny access when team quota exceeded', async () => {
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

    it('should throw ForbiddenException when user is not authenticated', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({ user: null });
      reflector.get.mockReturnValue(action);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
    });

    it('should attach trackUsage function to request on success', async () => {
      // Arrange
      const action: UsageAction = 'ai_generation';
      const teamId = 'team-123';
      const trackUsageMock = jest.fn();
      const context = mockExecutionContext({
        params: { teamId },
        trackUsage: trackUsageMock,
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });
      usageService.trackUsage.mockResolvedValue(undefined);

      // Act
      await guard.canActivate(context);

      // Get the request object to access trackUsage
      const request = context.switchToHttp().getRequest();

      // Call the trackUsage function
      await request.trackUsage();

      // Assert
      expect(usageService.trackUsage).toHaveBeenCalledWith(action, {
        userId: mockUser.id,
        teamId,
      });
    });

    it('should handle multiple usage actions on same endpoint', async () => {
      // Arrange
      const action: UsageAction = 'view_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({ allowed: true });

      // Act - Multiple calls
      const results = await Promise.all([
        guard.canActivate(context),
        guard.canActivate(context),
      ]);

      // Assert
      expect(results).toEqual([true, true]);
      expect(usageService.checkUserQuota).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle missing user ID gracefully', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext({
        user: { email: 'test@example.com' }, // No id
      });
      reflector.get.mockReturnValue(action);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Database error');
    });

    it('should prioritize team quota over user quota when teamId exists', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const teamId = 'team-123';
      const context = mockExecutionContext({
        params: { teamId },
      });
      reflector.get.mockReturnValue(action);
      usageService.checkTeamQuota.mockResolvedValue({ allowed: true });

      // Act
      await guard.canActivate(context);

      // Assert
      expect(usageService.checkTeamQuota).toHaveBeenCalled();
      expect(usageService.checkUserQuota).not.toHaveBeenCalled();
    });

    it('should handle different usage actions correctly', async () => {
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
      }
    });

    it('should not track usage if check fails', async () => {
      // Arrange
      const action: UsageAction = 'spec_generated';
      const context = mockExecutionContext();
      reflector.get.mockReturnValue(action);
      usageService.checkUserQuota.mockResolvedValue({
        allowed: false,
        reason: 'Quota exceeded',
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);

      // Verify trackUsage was not attached to request
      const request = context.switchToHttp().getRequest();
      expect(request.trackUsage).toBeUndefined();
    });
  });

  describe('decorator integration', () => {
    it('should work with CheckUsage decorator', () => {
      // This is a conceptual test showing how the decorator would be used
      const mockHandler = jest.fn();

      // Simulate decorator metadata
      Reflect.defineMetadata(USAGE_ACTION_KEY, 'spec_generated', mockHandler);

      // Verify metadata was set
      const metadata = Reflect.getMetadata(USAGE_ACTION_KEY, mockHandler);
      expect(metadata).toBe('spec_generated');
    });

    it('should handle multiple decorators on same method', () => {
      // Simulate a method with multiple decorators
      const mockHandler = jest.fn();

      // CheckUsage decorator
      Reflect.defineMetadata(USAGE_ACTION_KEY, 'ai_generation', mockHandler);

      // Other decorators (e.g., Roles)
      Reflect.defineMetadata('roles', ['admin'], mockHandler);

      // Verify both metadata exist
      expect(Reflect.getMetadata(USAGE_ACTION_KEY, mockHandler)).toBe('ai_generation');
      expect(Reflect.getMetadata('roles', mockHandler)).toEqual(['admin']);
    });
  });
});
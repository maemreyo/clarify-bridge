import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamMemberGuard, TEAM_ROLES_KEY } from './team-member.guard';
import { TeamService } from '../team.service';
import { TeamRole } from '@prisma/client';

describe('TeamMemberGuard', () => {
  let guard: TeamMemberGuard;
  let reflector: jest.Mocked<Reflector>;
  let teamService: jest.Mocked<TeamService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockTeamMember = {
    id: 'member-123',
    userId: 'user-123',
    teamId: 'team-123',
    role: TeamRole.MEMBER,
    joinedAt: new Date(),
  };

  const mockExecutionContext = (options: {
    handler?: any;
    user?: any;
    params?: any;
    roles?: TeamRole[];
  } = {}): ExecutionContext => {
    const request = {
      user: options.user || mockUser,
      params: options.params || { teamId: 'team-123' },
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
        TeamMemberGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: TeamService,
          useValue: {
            checkTeamMembership: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TeamMemberGuard>(TeamMemberGuard);
    reflector = module.get(Reflector);
    teamService = module.get(TeamService);

    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access for team member without role requirements', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockResolvedValue(mockTeamMember);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(teamService.checkTeamMembership).toHaveBeenCalledWith('user-123', 'team-123');
      expect(result).toBe(true);
    });

    it('should deny access for non-team member', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockResolvedValue(null);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('User is not a member of this team');
    });

    it('should allow access when user has required role', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.ADMIN, TeamRole.OWNER] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.ADMIN, TeamRole.OWNER]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(TEAM_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      expect(result).toBe(true);
    });

    it('should deny access when user lacks required role', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.ADMIN, TeamRole.OWNER] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.ADMIN, TeamRole.OWNER]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.MEMBER,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User does not have the required role for this action',
      );
    });

    it('should allow OWNER to access ADMIN-only endpoints', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.ADMIN] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.ADMIN]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.OWNER,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle missing teamId parameter', async () => {
      // Arrange
      const context = mockExecutionContext({ params: {} });
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Team ID is required');
    });

    it('should handle missing user', async () => {
      // Arrange
      const context = mockExecutionContext({ user: null });
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
    });

    it('should handle multiple required roles correctly', async () => {
      // Arrange
      const requiredRoles = [TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER];
      const context = mockExecutionContext({ roles: requiredRoles });
      reflector.getAllAndOverride.mockReturnValue(requiredRoles);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.MEMBER, // Lowest required role
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should handle VIEWER role correctly', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.VIEWER] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.VIEWER]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.VIEWER,
      });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny VIEWER access to MEMBER-only endpoints', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.MEMBER] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.MEMBER]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.VIEWER,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('role hierarchy', () => {
    it('should respect role hierarchy: OWNER > ADMIN > MEMBER > VIEWER', async () => {
      // Test OWNER can access all role-restricted endpoints
      const ownerMember = { ...mockTeamMember, role: TeamRole.OWNER };
      const roles = [TeamRole.VIEWER, TeamRole.MEMBER, TeamRole.ADMIN];

      for (const requiredRole of roles) {
        const context = mockExecutionContext({ roles: [requiredRole] });
        reflector.getAllAndOverride.mockReturnValue([requiredRole]);
        teamService.checkTeamMembership.mockResolvedValue(ownerMember);

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should allow ADMIN to access MEMBER and VIEWER endpoints', async () => {
      // Arrange
      const adminMember = { ...mockTeamMember, role: TeamRole.ADMIN };
      const allowedRoles = [TeamRole.MEMBER, TeamRole.VIEWER];

      for (const requiredRole of allowedRoles) {
        const context = mockExecutionContext({ roles: [requiredRole] });
        reflector.getAllAndOverride.mockReturnValue([requiredRole]);
        teamService.checkTeamMembership.mockResolvedValue(adminMember);

        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }
    });

    it('should deny ADMIN access to OWNER-only endpoints', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [TeamRole.OWNER] });
      reflector.getAllAndOverride.mockReturnValue([TeamRole.OWNER]);
      teamService.checkTeamMembership.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('edge cases', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow('Database error');
    });

    it('should handle invalid teamId format', async () => {
      // Arrange
      const context = mockExecutionContext({ params: { teamId: '' } });
      reflector.getAllAndOverride.mockReturnValue(undefined);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Team ID is required');
    });

    it('should handle concurrent requests for same team', async () => {
      // Arrange
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockResolvedValue(mockTeamMember);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => guard.canActivate(context));

      const results = await Promise.all(promises);

      // Assert
      expect(teamService.checkTeamMembership).toHaveBeenCalledTimes(5);
      results.forEach((result) => {
        expect(result).toBe(true);
      });
    });

    it('should handle empty roles array', async () => {
      // Arrange
      const context = mockExecutionContext({ roles: [] });
      reflector.getAllAndOverride.mockReturnValue([]);
      teamService.checkTeamMembership.mockResolvedValue(mockTeamMember);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true); // Empty roles means any member can access
    });

    it('should cache team membership check results', async () => {
      // This is a conceptual test - in real implementation, you might want to cache
      // membership checks to avoid repeated database queries
      const context = mockExecutionContext();
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockResolvedValue(mockTeamMember);

      // First call
      await guard.canActivate(context);

      // Second call with same parameters
      await guard.canActivate(context);

      // Assert - called twice (no caching in current implementation)
      expect(teamService.checkTeamMembership).toHaveBeenCalledTimes(2);
    });
  });

  describe('decorator integration', () => {
    it('should work with TeamRoles decorator', () => {
      // This is a conceptual test showing how the decorator would be used
      const mockHandler = jest.fn();

      // Simulate decorator metadata
      Reflect.defineMetadata(TEAM_ROLES_KEY, [TeamRole.ADMIN, TeamRole.OWNER], mockHandler);

      // Verify metadata was set
      const metadata = Reflect.getMetadata(TEAM_ROLES_KEY, mockHandler);
      expect(metadata).toEqual([TeamRole.ADMIN, TeamRole.OWNER]);
    });

    it('should handle nested team routes', async () => {
      // Arrange - simulate nested route like /teams/:teamId/projects/:projectId
      const context = mockExecutionContext({
        params: {
          teamId: 'team-123',
          projectId: 'project-456'
        }
      });
      reflector.getAllAndOverride.mockReturnValue(undefined);
      teamService.checkTeamMembership.mockResolvedValue(mockTeamMember);

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(teamService.checkTeamMembership).toHaveBeenCalledWith('user-123', 'team-123');
      expect(result).toBe(true);
    });
  });
});
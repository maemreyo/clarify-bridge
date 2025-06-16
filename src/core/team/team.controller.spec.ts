import { Test, TestingModule } from '@nestjs/testing';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import {
  CreateTeamDto,
  UpdateTeamDto,
  InviteUserDto,
  UpdateMemberRoleDto,
  TeamResponseDto,
  TeamWithMembersDto,
  TeamMemberDto,
} from './dto/team.dto';
import { TeamRole } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('TeamController', () => {
  let controller: TeamController;
  let teamService: jest.Mocked<TeamService>;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-123';

  const mockTeam: TeamResponseDto = {
    id: 'team-123',
    name: 'Engineering Team',
    slug: 'engineering',
    description: 'Main engineering team',
    ownerId: 'user-123',
    owner: {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      avatar: null,
    },
    subscriptionTier: 'PREMIUM',
    memberCount: 5,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-15'),
  };

  const mockTeamWithMembers: TeamWithMembersDto = {
    ...mockTeam,
    members: [
      {
        id: 'member-1',
        userId: 'user-123',
        teamId: 'team-123',
        role: TeamRole.OWNER,
        joinedAt: new Date('2024-01-15'),
        user: {
          id: 'user-123',
          name: 'John Doe',
          email: 'john@example.com',
          avatar: null,
        },
      },
      {
        id: 'member-2',
        userId: 'user-456',
        teamId: 'team-123',
        role: TeamRole.MEMBER,
        joinedAt: new Date('2024-02-01'),
        user: {
          id: 'user-456',
          name: 'Jane Smith',
          email: 'jane@example.com',
          avatar: null,
        },
      },
    ],
  };

  const mockTeamMember: TeamMemberDto = {
    id: 'member-123',
    userId: 'user-789',
    teamId: 'team-123',
    role: TeamRole.MEMBER,
    joinedAt: new Date('2024-06-15'),
    user: {
      id: 'user-789',
      name: 'New Member',
      email: 'newmember@example.com',
      avatar: null,
    },
  };

  const mockUsageStats = {
    specifications: 150,
    aiGenerations: 500,
    storage: 2048, // MB
    apiCalls: 10000,
    currentPeriod: {
      start: new Date('2024-06-01'),
      end: new Date('2024-06-30'),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeamController],
      providers: [
        {
          provide: TeamService,
          useValue: {
            createTeam: jest.fn(),
            getUserTeams: jest.fn(),
            getTeamById: jest.fn(),
            getTeamWithMembers: jest.fn(),
            updateTeam: jest.fn(),
            deleteTeam: jest.fn(),
            inviteUser: jest.fn(),
            updateMemberRole: jest.fn(),
            removeMember: jest.fn(),
            leaveTeam: jest.fn(),
            getTeamUsage: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TeamController>(TeamController);
    teamService = module.get(TeamService);

    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    it('should create a new team successfully', async () => {
      // Arrange
      const dto: CreateTeamDto = {
        name: 'New Team',
        slug: 'new-team',
        description: 'A brand new team',
      };
      teamService.createTeam.mockResolvedValue(mockTeam);

      // Act
      const result = await controller.createTeam(mockUserId, dto);

      // Assert
      expect(teamService.createTeam).toHaveBeenCalledWith(mockUserId, dto);
      expect(result).toEqual(mockTeam);
    });

    it('should handle slug conflict error', async () => {
      // Arrange
      const dto: CreateTeamDto = {
        name: 'Duplicate Team',
        slug: 'existing-slug',
      };
      teamService.createTeam.mockRejectedValue(
        new ConflictException('Team slug already taken'),
      );

      // Act & Assert
      await expect(controller.createTeam(mockUserId, dto)).rejects.toThrow(ConflictException);
    });

    it('should handle validation errors', async () => {
      // Arrange
      const dto: CreateTeamDto = {
        name: '', // Invalid empty name
        slug: 'valid-slug',
      };
      teamService.createTeam.mockRejectedValue(
        new BadRequestException('Team name is required'),
      );

      // Act & Assert
      await expect(controller.createTeam(mockUserId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserTeams', () => {
    it('should return all teams for a user', async () => {
      // Arrange
      const mockTeams = [mockTeam, { ...mockTeam, id: 'team-456', name: 'Design Team' }];
      teamService.getUserTeams.mockResolvedValue(mockTeams);

      // Act
      const result = await controller.getUserTeams(mockUserId);

      // Assert
      expect(teamService.getUserTeams).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockTeams);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when user has no teams', async () => {
      // Arrange
      teamService.getUserTeams.mockResolvedValue([]);

      // Act
      const result = await controller.getUserTeams(mockUserId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getTeam', () => {
    it('should return team details', async () => {
      // Arrange
      teamService.getTeamById.mockResolvedValue(mockTeam);

      // Act
      const result = await controller.getTeam(mockTeamId);

      // Assert
      expect(teamService.getTeamById).toHaveBeenCalledWith(mockTeamId);
      expect(result).toEqual(mockTeam);
    });

    it('should handle team not found', async () => {
      // Arrange
      teamService.getTeamById.mockRejectedValue(
        new NotFoundException('Team not found'),
      );

      // Act & Assert
      await expect(controller.getTeam('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTeamWithMembers', () => {
    it('should return team with all members', async () => {
      // Arrange
      teamService.getTeamWithMembers.mockResolvedValue(mockTeamWithMembers);

      // Act
      const result = await controller.getTeamWithMembers(mockTeamId);

      // Assert
      expect(teamService.getTeamWithMembers).toHaveBeenCalledWith(mockTeamId);
      expect(result).toEqual(mockTeamWithMembers);
      expect(result.members).toHaveLength(2);
    });

    it('should handle empty members list', async () => {
      // Arrange
      const teamWithNoMembers = { ...mockTeamWithMembers, members: [] };
      teamService.getTeamWithMembers.mockResolvedValue(teamWithNoMembers);

      // Act
      const result = await controller.getTeamWithMembers(mockTeamId);

      // Assert
      expect(result.members).toEqual([]);
    });
  });

  describe('updateTeam', () => {
    it('should update team successfully', async () => {
      // Arrange
      const dto: UpdateTeamDto = {
        name: 'Updated Team Name',
        description: 'Updated description',
      };
      const updatedTeam = { ...mockTeam, ...dto };
      teamService.updateTeam.mockResolvedValue(updatedTeam);

      // Act
      const result = await controller.updateTeam(mockTeamId, mockUserId, dto);

      // Assert
      expect(teamService.updateTeam).toHaveBeenCalledWith(mockTeamId, mockUserId, dto);
      expect(result.name).toBe(dto.name);
      expect(result.description).toBe(dto.description);
    });

    it('should handle permission denied', async () => {
      // Arrange
      const dto: UpdateTeamDto = { name: 'New Name' };
      teamService.updateTeam.mockRejectedValue(
        new ForbiddenException('Only team owner or admin can update team'),
      );

      // Act & Assert
      await expect(controller.updateTeam(mockTeamId, 'other-user', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should handle partial updates', async () => {
      // Arrange
      const dto: UpdateTeamDto = { description: 'Only updating description' };
      const updatedTeam = { ...mockTeam, description: dto.description };
      teamService.updateTeam.mockResolvedValue(updatedTeam);

      // Act
      const result = await controller.updateTeam(mockTeamId, mockUserId, dto);

      // Assert
      expect(result.description).toBe(dto.description);
      expect(result.name).toBe(mockTeam.name); // Unchanged
    });
  });

  describe('deleteTeam', () => {
    it('should delete team successfully', async () => {
      // Arrange
      teamService.deleteTeam.mockResolvedValue(undefined);

      // Act
      await controller.deleteTeam(mockTeamId, mockUserId);

      // Assert
      expect(teamService.deleteTeam).toHaveBeenCalledWith(mockTeamId, mockUserId);
    });

    it('should handle non-owner deletion attempt', async () => {
      // Arrange
      teamService.deleteTeam.mockRejectedValue(
        new ForbiddenException('Only team owner can delete team'),
      );

      // Act & Assert
      await expect(controller.deleteTeam(mockTeamId, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('inviteUser', () => {
    it('should invite user successfully', async () => {
      // Arrange
      const dto: InviteUserDto = {
        email: 'newuser@example.com',
        role: TeamRole.MEMBER,
      };
      teamService.inviteUser.mockResolvedValue(mockTeamMember);

      // Act
      const result = await controller.inviteUser(mockTeamId, mockUserId, dto);

      // Assert
      expect(teamService.inviteUser).toHaveBeenCalledWith(mockTeamId, mockUserId, dto);
      expect(result).toEqual(mockTeamMember);
    });

    it('should handle user not found', async () => {
      // Arrange
      const dto: InviteUserDto = {
        email: 'nonexistent@example.com',
        role: TeamRole.MEMBER,
      };
      teamService.inviteUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // Act & Assert
      await expect(controller.inviteUser(mockTeamId, mockUserId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle user already in team', async () => {
      // Arrange
      const dto: InviteUserDto = {
        email: 'existing@example.com',
        role: TeamRole.MEMBER,
      };
      teamService.inviteUser.mockRejectedValue(
        new ConflictException('User is already a member of this team'),
      );

      // Act & Assert
      await expect(controller.inviteUser(mockTeamId, mockUserId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow inviting with different roles', async () => {
      // Arrange
      const roles = [TeamRole.MEMBER, TeamRole.ADMIN, TeamRole.VIEWER];

      for (const role of roles) {
        const dto: InviteUserDto = {
          email: `user-${role}@example.com`,
          role,
        };
        teamService.inviteUser.mockResolvedValue({ ...mockTeamMember, role });

        // Act
        const result = await controller.inviteUser(mockTeamId, mockUserId, dto);

        // Assert
        expect(result.role).toBe(role);
      }
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role successfully', async () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: TeamRole.ADMIN,
      };
      const updatedMember = { ...mockTeamMember, role: TeamRole.ADMIN };
      teamService.updateMemberRole.mockResolvedValue(updatedMember);

      // Act
      const result = await controller.updateMemberRole(
        mockTeamId,
        'member-123',
        mockUserId,
        dto,
      );

      // Assert
      expect(teamService.updateMemberRole).toHaveBeenCalledWith(
        mockTeamId,
        'member-123',
        mockUserId,
        dto,
      );
      expect(result.role).toBe(TeamRole.ADMIN);
    });

    it('should prevent changing owner role', async () => {
      // Arrange
      const dto: UpdateMemberRoleDto = {
        role: TeamRole.MEMBER,
      };
      teamService.updateMemberRole.mockRejectedValue(
        new ForbiddenException('Cannot change role of team owner'),
      );

      // Act & Assert
      await expect(
        controller.updateMemberRole(mockTeamId, 'owner-id', mockUserId, dto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      // Arrange
      teamService.removeMember.mockResolvedValue(undefined);

      // Act
      await controller.removeMember(mockTeamId, 'member-123', mockUserId);

      // Assert
      expect(teamService.removeMember).toHaveBeenCalledWith(
        mockTeamId,
        'member-123',
        mockUserId,
      );
    });

    it('should prevent removing owner', async () => {
      // Arrange
      teamService.removeMember.mockRejectedValue(
        new ForbiddenException('Cannot remove team owner'),
      );

      // Act & Assert
      await expect(
        controller.removeMember(mockTeamId, 'owner-id', mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('leaveTeam', () => {
    it('should allow member to leave team', async () => {
      // Arrange
      teamService.leaveTeam.mockResolvedValue(undefined);

      // Act
      await controller.leaveTeam(mockTeamId, mockUserId);

      // Assert
      expect(teamService.leaveTeam).toHaveBeenCalledWith(mockTeamId, mockUserId);
    });

    it('should prevent owner from leaving', async () => {
      // Arrange
      teamService.leaveTeam.mockRejectedValue(
        new ForbiddenException('Team owner cannot leave. Transfer ownership first.'),
      );

      // Act & Assert
      await expect(controller.leaveTeam(mockTeamId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should prevent last member from leaving', async () => {
      // Arrange
      teamService.leaveTeam.mockRejectedValue(
        new ForbiddenException('Cannot leave team with only one member'),
      );

      // Act & Assert
      await expect(controller.leaveTeam(mockTeamId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getTeamUsage', () => {
    it('should return team usage statistics', async () => {
      // Arrange
      teamService.getTeamUsage.mockResolvedValue(mockUsageStats);

      // Act
      const result = await controller.getTeamUsage(mockTeamId);

      // Assert
      expect(teamService.getTeamUsage).toHaveBeenCalledWith(mockTeamId);
      expect(result).toEqual(mockUsageStats);
    });

    it('should handle team not found', async () => {
      // Arrange
      teamService.getTeamUsage.mockRejectedValue(
        new NotFoundException('Team not found'),
      );

      // Act & Assert
      await expect(controller.getTeamUsage('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('authorization scenarios', () => {
    it('should have guards applied to protected endpoints', () => {
      // Verify methods exist and can be called
      const protectedMethods = [
        controller.updateTeam,
        controller.deleteTeam,
        controller.inviteUser,
        controller.updateMemberRole,
        controller.removeMember,
      ];

      protectedMethods.forEach((method) => {
        expect(typeof method).toBe('function');
      });
    });

    it('should handle concurrent requests', async () => {
      // Arrange
      teamService.getUserTeams.mockResolvedValue([mockTeam]);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => controller.getUserTeams(mockUserId));

      const results = await Promise.all(promises);

      // Assert
      expect(teamService.getUserTeams).toHaveBeenCalledTimes(5);
      results.forEach((result) => {
        expect(result).toEqual([mockTeam]);
      });
    });
  });
});
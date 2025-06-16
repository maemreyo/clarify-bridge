import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaService } from '@core/database';
import { CreateTeamDto, UpdateTeamDto, InviteUserDto, UpdateMemberRoleDto } from './dto/team.dto';
import { TeamRole } from '@prisma/client';

describe('TeamService', () => {
  let service: TeamService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    password: 'hashed',
    subscriptionTier: 'FREE',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTeam = {
    id: 'team-123',
    name: 'Engineering Team',
    slug: 'engineering',
    description: 'Main engineering team',
    ownerId: 'user-123',
    subscriptionTier: 'FREE',
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      avatar: null,
    },
    _count: { members: 3 },
  };

  const mockTeamMember = {
    id: 'member-123',
    teamId: 'team-123',
    userId: 'user-123',
    role: TeamRole.OWNER,
    joinedAt: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        {
          provide: PrismaService,
          useValue: {
            team: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            teamMember: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('createTeam', () => {
    const createTeamDto: CreateTeamDto = {
      name: 'New Team',
      slug: 'new-team',
      description: 'A new team',
    };

    it('should successfully create a team', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);
      prismaService.team.create.mockResolvedValue(mockTeam);

      // Act
      const result = await service.createTeam('user-123', createTeamDto);

      // Assert
      expect(prismaService.team.findUnique).toHaveBeenCalledWith({
        where: { slug: createTeamDto.slug },
      });
      expect(prismaService.team.create).toHaveBeenCalledWith({
        data: {
          ...createTeamDto,
          ownerId: 'user-123',
          members: {
            create: {
              userId: 'user-123',
              role: TeamRole.OWNER,
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });
      expect(result).toEqual({
        id: mockTeam.id,
        name: mockTeam.name,
        slug: mockTeam.slug,
        description: mockTeam.description,
        ownerId: mockTeam.ownerId,
        owner: mockTeam.owner,
        subscriptionTier: mockTeam.subscriptionTier,
        memberCount: mockTeam._count.members,
        createdAt: mockTeam.createdAt,
        updatedAt: mockTeam.updatedAt,
      });
    });

    it('should throw ConflictException if slug already exists', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(mockTeam);

      // Act & Assert
      await expect(service.createTeam('user-123', createTeamDto)).rejects.toThrow(
        ConflictException
      );
      expect(prismaService.team.create).not.toHaveBeenCalled();
    });

    it('should handle database errors during team creation', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);
      prismaService.team.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createTeam('user-123', createTeamDto)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('getUserTeams', () => {
    it('should return all teams for a user', async () => {
      // Arrange
      const mockTeams = [mockTeam, { ...mockTeam, id: 'team-456', name: 'Design Team' }];
      prismaService.team.findMany.mockResolvedValue(mockTeams);

      // Act
      const result = await service.getUserTeams('user-123');

      // Assert
      expect(prismaService.team.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: 'user-123',
            },
          },
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Engineering Team');
      expect(result[1].name).toBe('Design Team');
    });

    it('should return empty array if user has no teams', async () => {
      // Arrange
      prismaService.team.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getUserTeams('user-123');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getTeamById', () => {
    it('should return team details', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(mockTeam);

      // Act
      const result = await service.getTeamById('team-123');

      // Assert
      expect(prismaService.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });
      expect(result.id).toBe('team-123');
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getTeamById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateTeam', () => {
    const updateDto: UpdateTeamDto = {
      name: 'Updated Team',
      description: 'Updated description',
    };

    it('should successfully update team', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.team.update.mockResolvedValue({ ...mockTeam, ...updateDto });

      // Act
      const result = await service.updateTeam('team-123', 'user-123', updateDto);

      // Assert
      expect(prismaService.teamMember.findFirst).toHaveBeenCalledWith({
        where: {
          teamId: 'team-123',
          userId: 'user-123',
          role: { in: [TeamRole.OWNER, TeamRole.ADMIN] },
        },
      });
      expect(prismaService.team.update).toHaveBeenCalledWith({
        where: { id: 'team-123' },
        data: updateDto,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });
      expect(result.name).toBe(updateDto.name);
    });

    it('should throw ForbiddenException if user lacks permission', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.MEMBER,
      });

      // Act & Assert
      await expect(service.updateTeam('team-123', 'user-123', updateDto)).rejects.toThrow(
        ForbiddenException
      );
      expect(prismaService.team.update).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateTeam('team-123', 'user-123', updateDto)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('deleteTeam', () => {
    it('should successfully delete team as owner', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(mockTeam);
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback(prismaService);
      });

      // Act
      await service.deleteTeam('team-123', 'user-123');

      // Assert
      expect(prismaService.team.findUnique).toHaveBeenCalledWith({
        where: { id: 'team-123' },
      });
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if team not found', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteTeam('team-123', 'user-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner', async () => {
      // Arrange
      prismaService.team.findUnique.mockResolvedValue({
        ...mockTeam,
        ownerId: 'other-user',
      });

      // Act & Assert
      await expect(service.deleteTeam('team-123', 'user-123')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('inviteUser', () => {
    const inviteDto: InviteUserDto = {
      email: 'newuser@example.com',
      role: TeamRole.MEMBER,
    };

    it('should successfully invite a new user', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        id: 'new-user-123',
        email: inviteDto.email,
      });
      prismaService.teamMember.findFirst.mockResolvedValueOnce(null);
      prismaService.teamMember.create.mockResolvedValue({
        ...mockTeamMember,
        userId: 'new-user-123',
        role: inviteDto.role,
      });

      // Act
      const result = await service.inviteUser('team-123', 'user-123', inviteDto);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: inviteDto.email },
      });
      expect(result.userId).toBe('new-user-123');
      expect(result.role).toBe(TeamRole.MEMBER);
    });

    it('should throw NotFoundException if user to invite not found', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.inviteUser('team-123', 'user-123', inviteDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw ConflictException if user already in team', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.teamMember.findFirst.mockResolvedValueOnce(mockTeamMember);

      // Act & Assert
      await expect(service.inviteUser('team-123', 'user-123', inviteDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('removeMember', () => {
    it('should successfully remove a member', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        userId: 'member-to-remove',
        role: TeamRole.MEMBER,
      });
      prismaService.teamMember.delete.mockResolvedValue({
        ...mockTeamMember,
        id: 'member-to-remove',
      });

      // Act
      await service.removeMember('team-123', 'member-to-remove', 'user-123');

      // Assert
      expect(prismaService.teamMember.delete).toHaveBeenCalledWith({
        where: { id: 'member-to-remove' },
      });
    });

    it('should throw ForbiddenException if trying to remove owner', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.ADMIN,
      });
      prismaService.teamMember.findFirst.mockResolvedValueOnce({
        ...mockTeamMember,
        role: TeamRole.OWNER,
      });

      // Act & Assert
      await expect(service.removeMember('team-123', 'owner-id', 'user-123')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('leaveTeam', () => {
    it('should allow member to leave team', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.MEMBER,
      });
      prismaService.teamMember.count.mockResolvedValue(5);
      prismaService.teamMember.delete.mockResolvedValue(mockTeamMember);

      // Act
      await service.leaveTeam('team-123', 'user-123');

      // Assert
      expect(prismaService.teamMember.delete).toHaveBeenCalledWith({
        where: {
          teamId: 'team-123',
          userId: 'user-123',
        },
      });
    });

    it('should throw ForbiddenException if owner tries to leave', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.OWNER,
      });

      // Act & Assert
      await expect(service.leaveTeam('team-123', 'user-123')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if last member tries to leave', async () => {
      // Arrange
      prismaService.teamMember.findFirst.mockResolvedValue({
        ...mockTeamMember,
        role: TeamRole.MEMBER,
      });
      prismaService.teamMember.count.mockResolvedValue(1);

      // Act & Assert
      await expect(service.leaveTeam('team-123', 'user-123')).rejects.toThrow(ForbiddenException);
    });
  });
});
//  Team management service

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@core/database';
import { TeamRole, Prisma } from '@prisma/client';
import { CreateTeamDto, UpdateTeamDto, InviteUserDto, UpdateMemberRoleDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new team
   */
  async createTeam(userId: string, dto: CreateTeamDto) {
    // Check if slug is already taken
    const existingTeam = await this.prisma.team.findUnique({
      where: { slug: dto.slug },
    });

    if (existingTeam) {
      throw new ConflictException('Team slug already taken');
    }

    const team = await this.prisma.team.create({
      data: {
        ...dto,
        ownerId: userId,
        members: {
          create: {
            userId,
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

    this.logger.log(`Team created: ${team.name} by user ${userId}`);

    return this.formatTeamResponse(team);
  }

  /**
   * Get all teams for a user
   */
  async getUserTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: {
        members: {
          some: {
            userId,
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

    return teams.map(team => this.formatTeamResponse(team));
  }

  /**
   * Get team by ID
   */
  async getTeamById(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
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

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return this.formatTeamResponse(team);
  }

  /**
   * Get team with members
   */
  async getTeamWithMembers(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return {
      ...this.formatTeamResponse(team),
      members: team.members.map(member => ({
        id: member.id,
        role: member.role,
        user: member.user,
        joinedAt: member.joinedAt,
      })),
    };
  }

  /**
   * Update team details
   */
  async updateTeam(teamId: string, userId: string, dto: UpdateTeamDto) {
    // Check if user has permission (OWNER or ADMIN)
    await this.checkTeamPermission(teamId, userId, [TeamRole.OWNER, TeamRole.ADMIN]);

    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: dto,
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

    this.logger.log(`Team updated: ${team.name}`);

    return this.formatTeamResponse(team);
  }

  /**
   * Delete team (owner only)
   */
  async deleteTeam(teamId: string, userId: string) {
    await this.checkTeamPermission(teamId, userId, [TeamRole.OWNER]);

    await this.prisma.team.delete({
      where: { id: teamId },
    });

    this.logger.log(`Team deleted: ${teamId}`);
  }

  /**
   * Invite user to team
   */
  async inviteUser(teamId: string, inviterId: string, dto: InviteUserDto) {
    // Check if inviter has permission
    await this.checkTeamPermission(teamId, inviterId, [TeamRole.OWNER, TeamRole.ADMIN]);

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user is already a member
    const existingMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException('User is already a team member');
    }

    // Add user to team
    const member = await this.prisma.teamMember.create({
      data: {
        userId: user.id,
        teamId,
        role: dto.role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`User ${user.email} added to team ${teamId} with role ${dto.role}`);

    return {
      id: member.id,
      role: member.role,
      user: member.user,
      joinedAt: member.joinedAt,
    };
  }

  /**
   * Update team member role
   */
  async updateMemberRole(
    teamId: string,
    memberId: string,
    updaterId: string,
    dto: UpdateMemberRoleDto,
  ) {
    // Only OWNER can update roles
    await this.checkTeamPermission(teamId, updaterId, [TeamRole.OWNER]);

    const member = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    // Cannot change owner role
    if (member.role === TeamRole.OWNER) {
      throw new BadRequestException('Cannot change owner role');
    }

    const updatedMember = await this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    this.logger.log(`Member role updated in team ${teamId}`);

    return {
      id: updatedMember.id,
      role: updatedMember.role,
      user: updatedMember.user,
      joinedAt: updatedMember.joinedAt,
    };
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, memberId: string, removerId: string) {
    // Check permission
    await this.checkTeamPermission(teamId, removerId, [TeamRole.OWNER, TeamRole.ADMIN]);

    const member = await this.prisma.teamMember.findFirst({
      where: {
        id: memberId,
        teamId,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    // Cannot remove owner
    if (member.role === TeamRole.OWNER) {
      throw new BadRequestException('Cannot remove team owner');
    }

    // ADMIN cannot remove another ADMIN
    const remover = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: removerId,
          teamId,
        },
      },
    });

    if (remover?.role === TeamRole.ADMIN && member.role === TeamRole.ADMIN) {
      throw new ForbiddenException('Admin cannot remove another admin');
    }

    await this.prisma.teamMember.delete({
      where: { id: memberId },
    });

    this.logger.log(`Member removed from team ${teamId}`);
  }

  /**
   * Leave team (self)
   */
  async leaveTeam(teamId: string, userId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this team');
    }

    // Owner cannot leave their own team
    if (member.role === TeamRole.OWNER) {
      throw new BadRequestException('Owner cannot leave their own team');
    }

    await this.prisma.teamMember.delete({
      where: { id: member.id },
    });

    this.logger.log(`User ${userId} left team ${teamId}`);
  }

  /**
   * Get team usage statistics
   */
  async getTeamUsage(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        usageQuota: true,
        usageCount: true,
        _count: {
          select: {
            specifications: true,
            members: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await this.prisma.usageLog.count({
      where: {
        teamId,
        action: 'spec_generated',
        createdAt: {
          gte: currentMonth,
        },
      },
    });

    return {
      quota: team.usageQuota,
      used: monthlyUsage,
      remaining: Math.max(0, team.usageQuota - monthlyUsage),
      totalSpecifications: team._count.specifications,
      totalMembers: team._count.members,
    };
  }

  /**
   * Check if user has required role in team
   */
  private async checkTeamPermission(teamId: string, userId: string, requiredRoles: TeamRole[]) {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }

    if (!requiredRoles.includes(member.role)) {
      throw new ForbiddenException(`You need one of these roles: ${requiredRoles.join(', ')}`);
    }

    return member;
  }

  /**
   * Format team response
   */
  private formatTeamResponse(team: any) {
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      avatar: team.avatar,
      ownerId: team.ownerId,
      owner: team.owner,
      membersCount: team._count?.members || 0,
      usageQuota: team.usageQuota,
      usageCount: team.usageCount,
      settings: team.settings,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}

// ============================================

// Updated: Team member access guard

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TeamRole } from '@prisma/client';
import { PrismaService } from '@core/database';

export const TEAM_ROLES_KEY = 'teamRoles';
export const TeamRoles = (...roles: TeamRole[]) =>
  (target: any, key?: string | symbol, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(TEAM_ROLES_KEY, roles, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(TEAM_ROLES_KEY, roles, target);
    return target;
  };

@Injectable()
export class TeamMemberGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[]>(
      TEAM_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamId = request.params.teamId || request.body.teamId;

    if (!user || !teamId) {
      return false;
    }

    const teamMember = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: user.id,
          teamId,
        },
      },
    });

    if (!teamMember) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // Store team member info in request for later use
    request.teamMember = teamMember;

    // If no specific roles required, just being a member is enough
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Check if user has one of the required roles
    const hasRequiredRole = requiredRoles.includes(teamMember.role);

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `You need one of these roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}

// ============================================
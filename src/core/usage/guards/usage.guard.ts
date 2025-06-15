// Updated: Usage limit guard

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsageService } from '../usage.service';
import { UsageAction } from '../interfaces/usage.interface';

export const USAGE_ACTION_KEY = 'usageAction';
export const CheckUsage = (action: UsageAction) =>
  (target: any, key?: string | symbol, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(USAGE_ACTION_KEY, action, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(USAGE_ACTION_KEY, action, target);
    return target;
  };

@Injectable()
export class UsageGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private usageService: UsageService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.get<UsageAction>(
      USAGE_ACTION_KEY,
      context.getHandler(),
    );

    if (!action) {
      // No usage check required
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const teamId = request.params.teamId || request.body.teamId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Check team quota if teamId is present
    if (teamId) {
      const teamCheck = await this.usageService.checkTeamQuota(teamId, action);
      if (!teamCheck.allowed) {
        throw new ForbiddenException(teamCheck.reason);
      }
    } else {
      // Check user quota
      const userCheck = await this.usageService.checkUserQuota(user.id, action);
      if (!userCheck.allowed) {
        throw new ForbiddenException(userCheck.reason);
      }
    }

    // Track usage after successful check
    request.trackUsage = async () => {
      await this.usageService.trackUsage(action, {
        userId: user.id,
        teamId,
      });
    };

    return true;
  }
}

// ============================================
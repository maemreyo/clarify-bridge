//  Usage statistics controller

import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsageService } from './usage.service';
import { UsageStatsQueryDto } from './dto/usage.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { TeamMemberGuard } from '@core/team/guards/team-member.guard';

@ApiTags('Usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('user/stats')
  @ApiOperation({ summary: 'Get current user usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved' })
  async getUserStats(@CurrentUser('id') userId: string, @Query() query: UsageStatsQueryDto) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.usageService.getUserUsageStats(userId, startDate, endDate);
  }

  @Get('team/:teamId/stats')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Get team usage statistics' })
  @ApiResponse({ status: 200, description: 'Team usage statistics retrieved' })
  async getTeamStats(@Param('teamId') teamId: string, @Query() query: UsageStatsQueryDto) {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.usageService.getTeamUsageStats(teamId, startDate, endDate);
  }
}

// ============================================

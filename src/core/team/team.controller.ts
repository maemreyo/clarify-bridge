// Updated: Team management controller

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
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
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { TeamMemberGuard, TeamRoles } from './guards/team-member.guard';
import { TeamRole } from '@prisma/client';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new team' })
  @ApiResponse({ status: 201, description: 'Team created successfully', type: TeamResponseDto })
  async createTeam(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teamService.createTeam(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all teams for current user' })
  @ApiResponse({ status: 200, description: 'Teams retrieved successfully', type: [TeamResponseDto] })
  async getUserTeams(
    @CurrentUser('id') userId: string,
  ): Promise<TeamResponseDto[]> {
    return this.teamService.getUserTeams(userId);
  }

  @Get(':teamId')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Get team details' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team retrieved successfully', type: TeamResponseDto })
  async getTeam(
    @Param('teamId') teamId: string,
  ): Promise<TeamResponseDto> {
    return this.teamService.getTeamById(teamId);
  }

  @Get(':teamId/members')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Get team with members' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team with members retrieved successfully', type: TeamWithMembersDto })
  async getTeamWithMembers(
    @Param('teamId') teamId: string,
  ): Promise<TeamWithMembersDto> {
    return this.teamService.getTeamWithMembers(teamId);
  }

  @Put(':teamId')
  @UseGuards(TeamMemberGuard)
  @TeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @ApiOperation({ summary: 'Update team details' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Team updated successfully', type: TeamResponseDto })
  async updateTeam(
    @Param('teamId') teamId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    return this.teamService.updateTeam(teamId, userId, dto);
  }

  @Delete(':teamId')
  @UseGuards(TeamMemberGuard)
  @TeamRoles(TeamRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete team (owner only)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 204, description: 'Team deleted successfully' })
  async deleteTeam(
    @Param('teamId') teamId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.teamService.deleteTeam(teamId, userId);
  }

  @Post(':teamId/members')
  @UseGuards(TeamMemberGuard)
  @TeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @ApiOperation({ summary: 'Invite user to team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 201, description: 'User invited successfully', type: TeamMemberDto })
  async inviteUser(
    @Param('teamId') teamId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteUserDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.inviteUser(teamId, userId, dto);
  }

  @Put(':teamId/members/:memberId/role')
  @UseGuards(TeamMemberGuard)
  @TeamRoles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Update member role (owner only)' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully', type: TeamMemberDto })
  async updateMemberRole(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<TeamMemberDto> {
    return this.teamService.updateMemberRole(teamId, memberId, userId, dto);
  }

  @Delete(':teamId/members/:memberId')
  @UseGuards(TeamMemberGuard)
  @TeamRoles(TeamRole.OWNER, TeamRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiParam({ name: 'memberId', description: 'Member ID' })
  @ApiResponse({ status: 204, description: 'Member removed successfully' })
  async removeMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.teamService.removeMember(teamId, memberId, userId);
  }

  @Delete(':teamId/leave')
  @UseGuards(TeamMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave team' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 204, description: 'Successfully left team' })
  async leaveTeam(
    @Param('teamId') teamId: string,
    @CurrentUser('id') userId: string,
  ): Promise<void> {
    await this.teamService.leaveTeam(teamId, userId);
  }

  @Get(':teamId/usage')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Get team usage statistics' })
  @ApiParam({ name: 'teamId', description: 'Team ID' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getTeamUsage(@Param('teamId') teamId: string) {
    return this.teamService.getTeamUsage(teamId);
  }
}

// ============================================
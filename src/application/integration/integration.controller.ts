//  Integration controller for API endpoints

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { TeamMemberGuard } from '@core/team/guards/team-member.guard';
import { IntegrationService } from './integration.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  SyncIntegrationDto,
  ProcessWebhookDto,
  ExportSpecificationDto,
  IntegrationResponseDto,
  SyncResultDto,
  ExportResultDto,
} from './dto/integration.dto';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('teams/:teamId')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Create a new integration for a team' })
  @ApiResponse({ status: 201, type: IntegrationResponseDto })
  async createIntegration(
    @Param('teamId') teamId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationService.createIntegration(teamId, user.id, dto);
  }

  @Get('teams/:teamId')
  @UseGuards(TeamMemberGuard)
  @ApiOperation({ summary: 'Get all integrations for a team' })
  @ApiResponse({ status: 200, type: [IntegrationResponseDto] })
  async getTeamIntegrations(
    @Param('teamId') teamId: string,
    @CurrentUser() user: any,
  ): Promise<IntegrationResponseDto[]> {
    return this.integrationService.getTeamIntegrations(teamId, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration configuration' })
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  async updateIntegration(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    return this.integrationService.updateIntegration(id, user.id, dto);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger integration sync' })
  @ApiResponse({ status: 200, type: SyncResultDto })
  async syncIntegration(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: SyncIntegrationDto,
  ): Promise<SyncResultDto> {
    return this.integrationService.syncIntegration(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete integration' })
  @ApiResponse({ status: 204, description: 'Integration deleted' })
  async deleteIntegration(@Param('id') id: string, @CurrentUser() user: any): Promise<void> {
    return this.integrationService.deleteIntegration(id, user.id);
  }

  @Post('specifications/:specId/export')
  @ApiOperation({ summary: 'Export specification to external tool' })
  @ApiResponse({ status: 200, type: ExportResultDto })
  async exportSpecification(
    @Param('specId') specificationId: string,
    @CurrentUser() user: any,
    @Body() dto: ExportSpecificationDto,
  ): Promise<ExportResultDto> {
    return this.integrationService.exportSpecification(specificationId, dto.integrationId, user.id);
  }

  // Webhook endpoint (no auth required)
  @Post('webhooks')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Process webhook from external service' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async processWebhook(@Body() dto: ProcessWebhookDto): Promise<void> {
    return this.integrationService.processWebhook(dto);
  }
}

// ============================================

//  Integration service for managing external tool connections

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database';
import { JobQueueService, QueueName, JobType } from '@core/queue';
import { NotificationService } from '@core/notification';
import { MonitoringService } from '@core/monitoring';
import {
  IntegrationType,
  IntegrationStatus,
  IntegrationConfig,
  SyncResult,
  WebhookEvent,
} from './interfaces/integration.interface';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  SyncIntegrationDto,
  ProcessWebhookDto,
} from './dto/integration.dto';
import { JiraProvider } from './providers/jira.provider';
import { LinearProvider } from './providers/linear.provider';
import { NotionProvider } from './providers/notion.provider';
import { GitHubProvider } from './providers/github.provider';
import { SlackProvider } from './providers/slack.provider';
import { NotificationType } from '@prisma/client';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly providers: Map<IntegrationType, any>;

  constructor(
    private prisma: PrismaService,
    private jobQueue: JobQueueService,
    private notificationService: NotificationService,
    private monitoringService: MonitoringService,
    private jiraProvider: JiraProvider,
    private linearProvider: LinearProvider,
    private notionProvider: NotionProvider,
    private githubProvider: GitHubProvider,
    private slackProvider: SlackProvider,
  ) {
    // Initialize provider map
    this.providers = new Map([
      [IntegrationType.JIRA, this.jiraProvider],
      [IntegrationType.LINEAR, this.linearProvider],
      [IntegrationType.NOTION, this.notionProvider],
      [IntegrationType.GITHUB, this.githubProvider],
      [IntegrationType.SLACK, this.slackProvider],
    ]);
  }

  /**
   * Create a new integration for a team
   */
  async createIntegration(teamId: string, userId: string, dto: CreateIntegrationDto): Promise<any> {
    // Verify team access
    const team = await this.prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
            role: { in: ['OWNER', 'ADMIN'] },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found or insufficient permissions');
    }

    // Check if integration already exists
    const existing = await this.prisma.integration.findFirst({
      where: {
        teamId,
        type: dto.type,
        isActive: true,
      },
    });

    if (existing) {
      throw new BadRequestException(`${dto.type} integration already exists for this team`);
    }

    // Validate configuration with provider
    const provider = this.providers.get(dto.type);
    if (!provider) {
      throw new BadRequestException(`Integration type ${dto.type} not supported`);
    }

    const isValid = await provider.validateConfig(dto.config);
    if (!isValid) {
      throw new BadRequestException('Invalid integration configuration');
    }

    // Create integration
    const integration = await this.prisma.integration.create({
      data: {
        teamId,
        type: dto.type,
        config: dto.config,
        isActive: true,
        createdByUserId: userId,
      },
    });

    // Initial sync
    await this.queueSync(integration.id, 'initial');

    // Send notification
    await this.notificationService.sendNotification(userId, NotificationType.INTEGRATION_CREATED, {
      title: `New ${dto.type} integration`,
      metadata: { integrationType: dto.type, teamName: team.name },
    });

    // Track activity
    await this.monitoringService.trackUserActivity(userId, 'integration.created', {
      teamId,
      integrationType: dto.type,
    });

    this.logger.log(`Integration created: ${dto.type} for team ${teamId}`);

    return integration;
  }

  /**
   * Update integration configuration
   */
  async updateIntegration(
    integrationId: string,
    userId: string,
    dto: UpdateIntegrationDto,
  ): Promise<any> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Check permissions
    const member = integration.team.members[0];
    if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
      throw new BadRequestException('Insufficient permissions');
    }

    // Validate new config if provided
    if (dto.config) {
      const provider = this.providers.get(integration.type as IntegrationType);
      const isValid = await provider.validateConfig(dto.config);
      if (!isValid) {
        throw new BadRequestException('Invalid integration configuration');
      }
    }

    // Update integration
    const updated = await this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        config: dto.config || integration.config,
        isActive: dto.isActive ?? integration.isActive,
      },
    });

    // Track activity
    await this.monitoringService.trackUserActivity(userId, 'integration.updated', {
      integrationId,
      changes: dto,
    });

    return updated;
  }

  /**
   * Sync integration data
   */
  async syncIntegration(
    integrationId: string,
    userId: string,
    dto: SyncIntegrationDto,
  ): Promise<SyncResult> {
    const integration = await this.validateIntegrationAccess(integrationId, userId);

    if (!integration.isActive) {
      throw new BadRequestException('Integration is not active');
    }

    // Queue sync job
    const job = await this.queueSync(integrationId, dto.syncType || 'manual');

    return {
      jobId: job.id,
      status: 'queued',
      message: 'Sync job has been queued',
    };
  }

  /**
   * Process webhook from external service
   */
  async processWebhook(dto: ProcessWebhookDto): Promise<void> {
    this.logger.log(`Processing webhook: ${dto.provider} - ${dto.event}`);

    // Find active integration
    const integration = await this.prisma.integration.findFirst({
      where: {
        type: dto.provider,
        isActive: true,
        config: {
          path: ['webhookSecret'],
          equals: dto.secret,
        },
      },
    });

    if (!integration) {
      throw new BadRequestException('Invalid webhook configuration');
    }

    // Get provider and process webhook
    const provider = this.providers.get(dto.provider);
    if (!provider) {
      throw new BadRequestException('Provider not found');
    }

    try {
      await provider.processWebhook(integration, dto.event, dto.payload);

      // Track webhook
      await this.prisma.webhookEvent.create({
        data: {
          integrationId: integration.id,
          event: dto.event,
          payload: dto.payload,
          status: 'processed',
        },
      });
    } catch (error) {
      // Log failed webhook
      await this.prisma.webhookEvent.create({
        data: {
          integrationId: integration.id,
          event: dto.event,
          payload: dto.payload,
          status: 'failed',
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Get integrations for a team
   */
  async getTeamIntegrations(teamId: string, userId: string): Promise<any[]> {
    // Verify team membership
    const member = await this.prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Team not found or not a member');
    }

    const integrations = await this.prisma.integration.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });

    // Mask sensitive config data
    return integrations.map(integration => ({
      ...integration,
      config: this.maskSensitiveConfig(integration.type as IntegrationType, integration.config),
    }));
  }

  /**
   * Delete integration
   */
  async deleteIntegration(integrationId: string, userId: string): Promise<void> {
    const integration = await this.validateIntegrationAccess(integrationId, userId, true);

    // Soft delete
    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { isActive: false },
    });

    // Notify
    await this.notificationService.sendNotification(userId, NotificationType.INTEGRATION_REMOVED, {
      title: `${integration.type.toUpperCase()} integration removed`,
      metadata: { integrationType: integration.type, teamName: integration.team.name },
    });

    this.logger.log(`Integration deleted: ${integrationId}`);
  }

  /**
   * Export specification to external tool
   */
  async exportSpecification(
    specificationId: string,
    integrationId: string,
    userId: string,
  ): Promise<any> {
    // Validate access to both specification and integration
    const [specification, integration] = await Promise.all([
      this.prisma.specification.findUnique({
        where: { id: specificationId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
          team: true,
        },
      }),
      this.validateIntegrationAccess(integrationId, userId),
    ]);

    if (!specification) {
      throw new NotFoundException('Specification not found');
    }

    // Check if user has access to specification
    if (specification.teamId !== integration.teamId) {
      throw new BadRequestException('Integration and specification must belong to same team');
    }

    // Get provider and export
    const provider = this.providers.get(integration.type);
    const result = await provider.exportSpecification(specification, integration.config);

    // Update specification with external link
    await this.prisma.specification.update({
      where: { id: specificationId },
      data: {
        externalLinks: {
          ...((specification.externalLinks as any) || {}),
          [integration.type]: result.externalId,
        },
      },
    });

    // Track activity
    await this.monitoringService.trackUserActivity(userId, 'specification.exported', {
      specificationId,
      integrationType: integration.type,
      externalId: result.externalId,
    });

    return result;
  }

  // Helper methods

  private async validateIntegrationAccess(
    integrationId: string,
    userId: string,
    requireAdmin: boolean = false,
  ): Promise<any> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    const member = integration.team.members[0];
    if (!member) {
      throw new NotFoundException('Not a team member');
    }

    if (requireAdmin && !['OWNER', 'ADMIN'].includes(member.role)) {
      throw new BadRequestException('Insufficient permissions');
    }

    return integration;
  }

  private async queueSync(integrationId: string, syncType: string): Promise<any> {
    return this.jobQueue.addJob(QueueName.INTEGRATION, {
      type: JobType.SYNC_INTEGRATION,
      payload: {
        integrationId,
        syncType,
      },
    });
  }

  private maskSensitiveConfig(type: IntegrationType, config: any): any {
    const masked = { ...config };

    // Mask sensitive fields based on integration type
    const sensitiveFields = {
      [IntegrationType.JIRA]: ['apiKey', 'email'],
      [IntegrationType.LINEAR]: ['apiKey'],
      [IntegrationType.NOTION]: ['apiKey', 'databaseId'],
      [IntegrationType.GITHUB]: ['accessToken'],
      [IntegrationType.SLACK]: ['webhookUrl', 'appToken'],
    };

    const fields = sensitiveFields[type] || [];
    fields.forEach(field => {
      if (masked[field]) {
        masked[field] = '***';
      }
    });

    return masked;
  }
}

// ============================================

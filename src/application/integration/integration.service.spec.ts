// Test integration service for external tool connections

import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService } from './integration.service';
import { PrismaService } from '@core/database';
import { JobQueueService } from '@core/queue';
import { NotificationService } from '@core/notification';
import { MonitoringService } from '@core/monitoring';
import { JiraProvider } from './providers/jira.provider';
import { LinearProvider } from './providers/linear.provider';
import { NotionProvider } from './providers/notion.provider';
import { GitHubProvider } from './providers/github.provider';
import { SlackProvider } from './providers/slack.provider';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  SyncIntegrationDto,
  ProcessWebhookDto,
} from './dto/integration.dto';
import {
  IntegrationType,
  IntegrationStatus,
  SyncResult,
  ExportResult,
} from './interfaces/integration.interface';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let prismaService: jest.Mocked<PrismaService>;
  let jobQueueService: jest.Mocked<JobQueueService>;
  let notificationService: jest.Mocked<NotificationService>;
  let monitoringService: jest.Mocked<MonitoringService>;
  let jiraProvider: jest.Mocked<JiraProvider>;
  let linearProvider: jest.Mocked<LinearProvider>;
  let notionProvider: jest.Mocked<NotionProvider>;
  let githubProvider: jest.Mocked<GitHubProvider>;
  let slackProvider: jest.Mocked<SlackProvider>;

  // Mock data
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockTeam = {
    id: 'team-456',
    name: 'Test Team',
    members: [
      { userId: mockUser.id, role: 'OWNER' },
      { userId: 'user-789', role: 'MEMBER' },
    ],
  };

  const mockSpecification = {
    id: 'spec-789',
    title: 'Test Specification',
    description: 'Test specification for integration',
    authorId: mockUser.id,
    teamId: mockTeam.id,
    versions: [
      {
        id: 'version-123',
        version: 1,
        pmView: { overview: 'PM view content' },
        frontendView: { components: [] },
        backendView: { apis: [] },
      },
    ],
  };

  const mockJiraIntegration = {
    id: 'integration-123',
    teamId: mockTeam.id,
    type: IntegrationType.JIRA,
    config: {
      name: 'JIRA',
      domain: 'company.atlassian.net',
      email: 'admin@company.com',
      apiKey: 'test-api-key',
      projectKey: 'TEST',
    },
    status: IntegrationStatus.ACTIVE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLinearIntegration = {
    id: 'integration-456',
    teamId: mockTeam.id,
    type: IntegrationType.LINEAR,
    config: {
      name: 'LINEAR',
      apiKey: 'lin_test_key',
      teamId: 'linear-team-id',
    },
    status: IntegrationStatus.ACTIVE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSyncResult: SyncResult = {
    status: 'success',
    message: 'Sync completed successfully',
    syncedItems: 5,
  };

  const mockExportResult: ExportResult = {
    externalId: 'JIRA-123',
    externalUrl: 'https://company.atlassian.net/browse/JIRA-123',
    provider: IntegrationType.JIRA,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      team: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      integration: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      specification: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      webhookEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      export: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JobQueueService,
          useValue: {
            addJob: jest.fn(),
            getJob: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
            sendBulkNotifications: jest.fn(),
          },
        },
        {
          provide: MonitoringService,
          useValue: {
            trackIntegrationEvent: jest.fn(),
            trackUserActivity: jest.fn(),
          },
        },
        {
          provide: JiraProvider,
          useValue: {
            type: IntegrationType.JIRA,
            validateConfig: jest.fn(),
            testConnection: jest.fn(),
            sync: jest.fn(),
            exportSpecification: jest.fn(),
            processWebhook: jest.fn(),
          },
        },
        {
          provide: LinearProvider,
          useValue: {
            type: IntegrationType.LINEAR,
            validateConfig: jest.fn(),
            testConnection: jest.fn(),
            sync: jest.fn(),
            exportSpecification: jest.fn(),
            processWebhook: jest.fn(),
          },
        },
        {
          provide: NotionProvider,
          useValue: {
            type: IntegrationType.NOTION,
            validateConfig: jest.fn(),
            testConnection: jest.fn(),
            sync: jest.fn(),
            exportSpecification: jest.fn(),
            processWebhook: jest.fn(),
          },
        },
        {
          provide: GitHubProvider,
          useValue: {
            type: IntegrationType.GITHUB,
            validateConfig: jest.fn(),
            testConnection: jest.fn(),
            sync: jest.fn(),
            exportSpecification: jest.fn(),
            processWebhook: jest.fn(),
          },
        },
        {
          provide: SlackProvider,
          useValue: {
            type: IntegrationType.SLACK,
            validateConfig: jest.fn(),
            testConnection: jest.fn(),
            sync: jest.fn(),
            exportSpecification: jest.fn(),
            processWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    prismaService = module.get(PrismaService);
    jobQueueService = module.get(JobQueueService);
    notificationService = module.get(NotificationService);
    monitoringService = module.get(MonitoringService);
    jiraProvider = module.get(JiraProvider);
    linearProvider = module.get(LinearProvider);
    notionProvider = module.get(NotionProvider);
    githubProvider = module.get(GitHubProvider);
    slackProvider = module.get(SlackProvider);

    jest.clearAllMocks();
  });

  describe('createIntegration', () => {
    const createJiraDto: CreateIntegrationDto = {
      type: IntegrationType.JIRA,
      config: {
        domain: 'company.atlassian.net',
        email: 'admin@company.com',
        apiKey: 'test-api-key',
        projectKey: 'TEST',
      },
    };

    beforeEach(() => {
      prismaService.team.findFirst.mockResolvedValue(mockTeam as any);
      prismaService.integration.findFirst.mockResolvedValue(null); // No existing integration
      jiraProvider.validateConfig.mockResolvedValue(true);
      jiraProvider.testConnection.mockResolvedValue(true);
      prismaService.integration.create.mockResolvedValue(mockJiraIntegration as any);
    });

    it('should create integration successfully', async () => {
      // Act
      const result = await service.createIntegration(
        mockTeam.id,
        mockUser.id,
        createJiraDto,
      );

      // Assert
      expect(prismaService.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTeam.id,
          members: {
            some: {
              userId: mockUser.id,
              role: { in: ['OWNER', 'ADMIN'] },
            },
          },
        },
      });

      expect(jiraProvider.validateConfig).toHaveBeenCalledWith({
        name: 'JIRA',
        ...createJiraDto.config,
      });

      expect(prismaService.integration.create).toHaveBeenCalledWith({
        data: {
          teamId: mockTeam.id,
          type: createJiraDto.type,
          config: {
            name: 'JIRA',
            ...createJiraDto.config,
          },
          status: IntegrationStatus.ACTIVE,
          isActive: true,
          createdBy: mockUser.id,
        },
      });

      expect(result).toEqual(mockJiraIntegration);
      expect(monitoringService.trackIntegrationEvent).toHaveBeenCalledWith(
        mockUser.id,
        'integration.created',
        {
          integrationType: IntegrationType.JIRA,
          teamId: mockTeam.id,
        },
      );
    });

    it('should throw NotFoundException when team not found', async () => {
      // Arrange
      prismaService.team.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createIntegration(mockTeam.id, mockUser.id, createJiraDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user has insufficient permissions', async () => {
      // Arrange
      const teamWithMemberRole = {
        ...mockTeam,
        members: [{ userId: mockUser.id, role: 'MEMBER' }],
      };
      prismaService.team.findFirst.mockResolvedValue(teamWithMemberRole as any);

      // Act & Assert
      await expect(
        service.createIntegration(mockTeam.id, mockUser.id, createJiraDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when integration already exists', async () => {
      // Arrange
      prismaService.integration.findFirst.mockResolvedValue(mockJiraIntegration as any);

      // Act & Assert
      await expect(
        service.createIntegration(mockTeam.id, mockUser.id, createJiraDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported integration type', async () => {
      // Arrange
      const invalidDto: CreateIntegrationDto = {
        type: 'INVALID_TYPE' as IntegrationType,
        config: {},
      };

      // Act & Assert
      await expect(
        service.createIntegration(mockTeam.id, mockUser.id, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when config validation fails', async () => {
      // Arrange
      jiraProvider.validateConfig.mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.createIntegration(mockTeam.id, mockUser.id, createJiraDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send notification to team members', async () => {
      // Act
      await service.createIntegration(mockTeam.id, mockUser.id, createJiraDto);

      // Assert
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('updateIntegration', () => {
    const updateDto: UpdateIntegrationDto = {
      config: {
        projectKey: 'UPDATED',
        issueTypeId: 'bug',
      },
    };

    beforeEach(() => {
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      jiraProvider.validateConfig.mockResolvedValue(true);
      prismaService.integration.update.mockResolvedValue({
        ...mockJiraIntegration,
        config: {
          ...mockJiraIntegration.config,
          ...updateDto.config,
        },
      } as any);
    });

    it('should update integration successfully', async () => {
      // Act
      const result = await service.updateIntegration(
        mockJiraIntegration.id,
        mockUser.id,
        updateDto,
      );

      // Assert
      expect(jiraProvider.validateConfig).toHaveBeenCalledWith({
        ...mockJiraIntegration.config,
        ...updateDto.config,
      });

      expect(prismaService.integration.update).toHaveBeenCalledWith({
        where: { id: mockJiraIntegration.id },
        data: {
          config: {
            ...mockJiraIntegration.config,
            ...updateDto.config,
          },
          status: IntegrationStatus.ACTIVE,
        },
      });

      expect(result.config.projectKey).toBe('UPDATED');
    });

    it('should throw NotFoundException when integration not found', async () => {
      // Arrange
      prismaService.integration.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateIntegration(mockJiraIntegration.id, mockUser.id, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteIntegration', () => {
    beforeEach(() => {
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      prismaService.integration.update.mockResolvedValue({
        ...mockJiraIntegration,
        isActive: false,
      } as any);
    });

    it('should soft delete integration successfully', async () => {
      // Act
      await service.deleteIntegration(mockJiraIntegration.id, mockUser.id);

      // Assert
      expect(prismaService.integration.update).toHaveBeenCalledWith({
        where: { id: mockJiraIntegration.id },
        data: {
          isActive: false,
          status: IntegrationStatus.INACTIVE,
        },
      });

      expect(monitoringService.trackIntegrationEvent).toHaveBeenCalledWith(
        mockUser.id,
        'integration.deleted',
        {
          integrationId: mockJiraIntegration.id,
          integrationType: IntegrationType.JIRA,
        },
      );
    });
  });

  describe('syncIntegration', () => {
    const syncDto: SyncIntegrationDto = {
      force: false,
    };

    beforeEach(() => {
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      jiraProvider.sync.mockResolvedValue(mockSyncResult);
      jobQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);
    });

    it('should queue sync job successfully', async () => {
      // Act
      const result = await service.syncIntegration(
        mockJiraIntegration.id,
        mockUser.id,
        syncDto,
      );

      // Assert
      expect(jobQueueService.addJob).toHaveBeenCalledWith(
        'integration-sync',
        'integration.sync',
        {
          integrationId: mockJiraIntegration.id,
          userId: mockUser.id,
          force: syncDto.force,
        },
        { priority: 5 },
      );

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'queued',
        message: 'Sync job queued successfully',
      });
    });

    it('should throw NotFoundException when integration not found', async () => {
      // Arrange
      prismaService.integration.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.syncIntegration(mockJiraIntegration.id, mockUser.id, syncDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportSpecification', () => {
    beforeEach(() => {
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification as any);
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      jiraProvider.exportSpecification.mockResolvedValue(mockExportResult);
      prismaService.export.create.mockResolvedValue({
        id: 'export-123',
        ...mockExportResult,
      } as any);
    });

    it('should export specification successfully', async () => {
      // Act
      const result = await service.exportSpecification(
        mockSpecification.id,
        mockJiraIntegration.id,
        mockUser.id,
      );

      // Assert
      expect(jiraProvider.exportSpecification).toHaveBeenCalledWith(
        mockSpecification,
        mockJiraIntegration.config,
      );

      expect(prismaService.export.create).toHaveBeenCalledWith({
        data: {
          specificationId: mockSpecification.id,
          integrationId: mockJiraIntegration.id,
          externalId: mockExportResult.externalId,
          externalUrl: mockExportResult.externalUrl,
          provider: mockExportResult.provider,
          exportedBy: mockUser.id,
        },
      });

      expect(result).toEqual(expect.objectContaining(mockExportResult));
    });

    it('should throw NotFoundException when specification not found', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.exportSpecification(
          mockSpecification.id,
          mockJiraIntegration.id,
          mockUser.id,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('processWebhook', () => {
    const webhookDto: ProcessWebhookDto = {
      integrationId: mockJiraIntegration.id,
      event: 'issue.updated',
      payload: {
        issue: {
          id: 'JIRA-123',
          key: 'TEST-123',
          fields: {
            summary: 'Updated issue',
          },
        },
      },
      signature: 'webhook-signature',
    };

    beforeEach(() => {
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      prismaService.webhookEvent.create.mockResolvedValue({
        id: 'webhook-event-123',
        ...webhookDto,
        status: 'pending',
        createdAt: new Date(),
      } as any);
      jiraProvider.processWebhook.mockResolvedValue(undefined);
    });

    it('should process webhook successfully', async () => {
      // Act
      await service.processWebhook(webhookDto);

      // Assert
      expect(prismaService.webhookEvent.create).toHaveBeenCalledWith({
        data: {
          integrationId: webhookDto.integrationId,
          event: webhookDto.event,
          payload: webhookDto.payload,
          status: 'pending',
        },
      });

      expect(jiraProvider.processWebhook).toHaveBeenCalledWith(
        mockJiraIntegration,
        webhookDto.event,
        webhookDto.payload,
      );

      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'webhook-event-123' },
        data: { status: 'processed' },
      });
    });

    it('should handle webhook processing errors', async () => {
      // Arrange
      const error = new Error('Webhook processing failed');
      jiraProvider.processWebhook.mockRejectedValue(error);

      // Act
      await service.processWebhook(webhookDto);

      // Assert
      expect(prismaService.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'webhook-event-123' },
        data: {
          status: 'failed',
          error: 'Webhook processing failed',
        },
      });
    });
  });

  describe('getTeamIntegrations', () => {
    beforeEach(() => {
      prismaService.integration.findMany.mockResolvedValue([
        mockJiraIntegration,
        mockLinearIntegration,
      ] as any);
    });

    it('should get team integrations successfully', async () => {
      // Act
      const result = await service.getTeamIntegrations(mockTeam.id, mockUser.id);

      // Assert
      expect(prismaService.integration.findMany).toHaveBeenCalledWith({
        where: {
          teamId: mockTeam.id,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toEqual([mockJiraIntegration, mockLinearIntegration]);
    });

    it('should filter integrations by type when specified', async () => {
      // Act
      await service.getTeamIntegrations(mockTeam.id, mockUser.id, IntegrationType.JIRA);

      // Assert
      expect(prismaService.integration.findMany).toHaveBeenCalledWith({
        where: {
          teamId: mockTeam.id,
          isActive: true,
          type: IntegrationType.JIRA,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('testIntegrationConnection', () => {
    beforeEach(() => {
      prismaService.integration.findUnique.mockResolvedValue(mockJiraIntegration as any);
      jiraProvider.testConnection.mockResolvedValue(true);
    });

    it('should test connection successfully', async () => {
      // Act
      const result = await service.testIntegrationConnection(
        mockJiraIntegration.id,
        mockUser.id,
      );

      // Assert
      expect(jiraProvider.testConnection).toHaveBeenCalledWith(mockJiraIntegration.config);
      expect(result).toBe(true);
    });

    it('should handle connection test failure', async () => {
      // Arrange
      jiraProvider.testConnection.mockResolvedValue(false);

      // Act
      const result = await service.testIntegrationConnection(
        mockJiraIntegration.id,
        mockUser.id,
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('private helper methods', () => {
    it('should check team access correctly', async () => {
      // Arrange
      prismaService.team.findFirst.mockResolvedValue(mockTeam as any);

      // Act & Assert - This is tested indirectly through other methods
      await service.createIntegration(mockTeam.id, mockUser.id, {
        type: IntegrationType.JIRA,
        config: {},
      });

      expect(prismaService.team.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockTeam.id,
          members: {
            some: {
              userId: mockUser.id,
              role: { in: ['OWNER', 'ADMIN'] },
            },
          },
        },
      });
    });

    it('should get provider for integration type', () => {
      // This is tested indirectly through all the other methods
      // The provider map initialization is tested in constructor
      expect(service['providers'].get(IntegrationType.JIRA)).toBe(jiraProvider);
      expect(service['providers'].get(IntegrationType.LINEAR)).toBe(linearProvider);
      expect(service['providers'].get(IntegrationType.NOTION)).toBe(notionProvider);
    });
  });
});
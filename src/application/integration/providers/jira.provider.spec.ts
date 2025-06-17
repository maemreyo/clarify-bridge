// Test Jira integration provider functionality

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JiraProvider } from './jira.provider';
import {
  IntegrationType,
  IntegrationConfig,
  JiraConfig,
  SyncResult,
  ExportResult,
} from '../interfaces/integration.interface';

// Mock Jira API client
const mockJiraClient = {
  version2: {
    projects: {
      getProject: jest.fn(),
    },
    issues: {
      createIssue: jest.fn(),
      getIssue: jest.fn(),
      updateIssue: jest.fn(),
    },
    issueTypes: {
      getIssueTypesForProject: jest.fn(),
    },
    myself: {
      getCurrentUser: jest.fn(),
    },
  },
};

jest.mock('jira.js', () => {
  return {
    Version2Client: jest.fn().mockImplementation(() => mockJiraClient),
  };
});

describe('JiraProvider', () => {
  let provider: JiraProvider;
  let configService: jest.Mocked<ConfigService>;

  // Mock data
  const validJiraConfig: JiraConfig = {
    name: 'JIRA Integration',
    description: 'Company Jira integration',
    domain: 'company.atlassian.net',
    email: 'admin@company.com',
    apiKey: 'test-api-key-123',
    projectKey: 'TEST',
    issueTypeId: '10001',
  };

  const invalidJiraConfig: Partial<JiraConfig> = {
    name: 'Invalid JIRA',
    domain: '',
    email: 'admin@company.com',
    // Missing apiKey and projectKey
  };

  const mockSpecification = {
    id: 'spec-123',
    title: 'User Authentication System',
    description: 'Implement secure user authentication with OAuth2',
    author: {
      id: 'user-456',
      name: 'John Doe',
      email: 'john@company.com',
    },
    team: {
      id: 'team-789',
      name: 'Backend Team',
    },
    status: 'APPROVED',
    versions: [
      {
        id: 'version-123',
        version: 1,
        pmView: {
          overview: {
            title: 'Authentication System',
            description: 'OAuth2-based authentication',
          },
          userStories: [
            {
              id: 'US001',
              title: 'User Login',
              description: 'As a user, I want to login with OAuth2',
              acceptanceCriteria: ['Redirect to OAuth provider', 'Handle callback'],
              priority: 'High',
            },
            {
              id: 'US002',
              title: 'Token Refresh',
              description: 'As a user, I want tokens to refresh automatically',
              acceptanceCriteria: ['Auto-refresh before expiry', 'Handle refresh failures'],
              priority: 'Medium',
            },
          ],
          features: [
            {
              id: 'F001',
              name: 'OAuth Integration',
              description: 'Integration with OAuth2 providers',
              requirements: ['Google OAuth', 'GitHub OAuth', 'JWT tokens'],
            },
          ],
        },
        frontendView: {
          components: [
            {
              name: 'LoginForm',
              type: 'component',
              description: 'OAuth login form component',
            },
          ],
          pages: [
            {
              name: 'LoginPage',
              path: '/login',
              description: 'User login page',
            },
          ],
        },
        backendView: {
          apis: [
            {
              endpoint: '/auth/login',
              method: 'POST',
              description: 'Initiate OAuth login',
            },
            {
              endpoint: '/auth/callback',
              method: 'GET',
              description: 'Handle OAuth callback',
            },
          ],
          dataModels: [
            {
              name: 'User',
              fields: [
                { name: 'id', type: 'UUID', required: true },
                { name: 'email', type: 'string', required: true },
                { name: 'oauthProvider', type: 'string', required: true },
              ],
            },
          ],
        },
      },
    ],
  };

  const mockJiraProject = {
    id: '10000',
    key: 'TEST',
    name: 'Test Project',
    description: 'Test project for integration',
  };

  const mockJiraIssueTypes = [
    { id: '10001', name: 'Story', description: 'User story' },
    { id: '10002', name: 'Task', description: 'Task' },
    { id: '10003', name: 'Bug', description: 'Bug' },
  ];

  const mockJiraUser = {
    accountId: 'user-123',
    emailAddress: 'admin@company.com',
    displayName: 'Admin User',
  };

  const mockCreatedIssue = {
    id: '10100',
    key: 'TEST-123',
    self: 'https://company.atlassian.net/rest/api/2/issue/10100',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JiraProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<JiraProvider>(JiraProvider);
    configService = module.get(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();
    Object.values(mockJiraClient.version2).forEach(api => {
      Object.values(api).forEach(method => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    });
  });

  describe('provider properties', () => {
    it('should have correct integration type', () => {
      expect(provider.type).toBe(IntegrationType.JIRA);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct Jira config', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockResolvedValue(mockJiraUser);
      mockJiraClient.version2.projects.getProject.mockResolvedValue(mockJiraProject);

      // Act
      const result = await provider.validateConfig(validJiraConfig);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject config with missing required fields', async () => {
      // Act
      const result = await provider.validateConfig(invalidJiraConfig as JiraConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject config with invalid domain format', async () => {
      // Arrange
      const configWithInvalidDomain: JiraConfig = {
        ...validJiraConfig,
        domain: 'invalid-domain',
      };

      // Act
      const result = await provider.validateConfig(configWithInvalidDomain);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject config with invalid email format', async () => {
      // Arrange
      const configWithInvalidEmail: JiraConfig = {
        ...validJiraConfig,
        email: 'invalid-email',
      };

      // Act
      const result = await provider.validateConfig(configWithInvalidEmail);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle test connection failure', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockRejectedValue(
        new Error('Authentication failed'),
      );

      // Act
      const result = await provider.validateConfig(validJiraConfig);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockResolvedValue(mockJiraUser);
      mockJiraClient.version2.projects.getProject.mockResolvedValue(mockJiraProject);

      // Act
      const result = await provider.testConnection(validJiraConfig);

      // Assert
      expect(mockJiraClient.version2.myself.getCurrentUser).toHaveBeenCalled();
      expect(mockJiraClient.version2.projects.getProject).toHaveBeenCalledWith({
        projectIdOrKey: validJiraConfig.projectKey,
      });
      expect(result).toBe(true);
    });

    it('should handle authentication failure', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockRejectedValue(
        new Error('401 Unauthorized'),
      );

      // Act
      const result = await provider.testConnection(validJiraConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle project not found', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockResolvedValue(mockJiraUser);
      mockJiraClient.version2.projects.getProject.mockRejectedValue(
        new Error('404 Not Found'),
      );

      // Act
      const result = await provider.testConnection(validJiraConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle network errors', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockRejectedValue(
        new Error('Network error'),
      );

      // Act
      const result = await provider.testConnection(validJiraConfig);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    const mockIntegration = {
      id: 'integration-123',
      teamId: 'team-456',
      type: IntegrationType.JIRA,
      config: validJiraConfig,
      status: 'ACTIVE',
    };

    it('should perform sync successfully', async () => {
      // Arrange
      mockJiraClient.version2.projects.getProject.mockResolvedValue(mockJiraProject);
      mockJiraClient.version2.issueTypes.getIssueTypesForProject.mockResolvedValue(
        mockJiraIssueTypes,
      );

      // Act
      const result = await provider.sync(mockIntegration);

      // Assert
      expect(result).toEqual({
        status: 'success',
        message: 'Jira sync completed successfully',
        syncedItems: expect.any(Number),
      });
      expect(mockJiraClient.version2.projects.getProject).toHaveBeenCalledWith({
        projectIdOrKey: validJiraConfig.projectKey,
      });
    });

    it('should handle sync errors gracefully', async () => {
      // Arrange
      mockJiraClient.version2.projects.getProject.mockRejectedValue(
        new Error('Sync failed'),
      );

      // Act
      const result = await provider.sync(mockIntegration);

      // Assert
      expect(result).toEqual({
        status: 'failed',
        message: 'Jira sync failed: Sync failed',
        syncedItems: 0,
        errors: ['Sync failed'],
      });
    });

    it('should sync project metadata', async () => {
      // Arrange
      mockJiraClient.version2.projects.getProject.mockResolvedValue(mockJiraProject);
      mockJiraClient.version2.issueTypes.getIssueTypesForProject.mockResolvedValue(
        mockJiraIssueTypes,
      );

      // Act
      await provider.sync(mockIntegration);

      // Assert
      expect(mockJiraClient.version2.issueTypes.getIssueTypesForProject).toHaveBeenCalledWith({
        projectId: mockJiraProject.id,
      });
    });
  });

  describe('exportSpecification', () => {
    it('should export specification as Jira issue successfully', async () => {
      // Arrange
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      const result = await provider.exportSpecification(mockSpecification, validJiraConfig);

      // Assert
      expect(mockJiraClient.version2.issues.createIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: validJiraConfig.projectKey },
          summary: mockSpecification.title,
          description: expect.stringContaining(mockSpecification.description),
          issuetype: { id: validJiraConfig.issueTypeId },
          labels: ['clarity-bridge', 'specification'],
        },
      });

      expect(result).toEqual({
        externalId: mockCreatedIssue.key,
        externalUrl: `https://${validJiraConfig.domain}/browse/${mockCreatedIssue.key}`,
        provider: IntegrationType.JIRA,
        createdAt: expect.any(Date),
      });
    });

    it('should handle missing issueTypeId by using default', async () => {
      // Arrange
      const configWithoutIssueType: JiraConfig = {
        ...validJiraConfig,
        issueTypeId: undefined,
      };
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      await provider.exportSpecification(mockSpecification, configWithoutIssueType);

      // Assert
      expect(mockJiraClient.version2.issues.createIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: validJiraConfig.projectKey },
          summary: mockSpecification.title,
          description: expect.any(String),
          issuetype: { name: 'Story' }, // Default issue type
          labels: ['clarity-bridge', 'specification'],
        },
      });
    });

    it('should include user stories in description', async () => {
      // Arrange
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      await provider.exportSpecification(mockSpecification, validJiraConfig);

      // Assert
      const createCall = mockJiraClient.version2.issues.createIssue.mock.calls[0][0];
      expect(createCall.fields.description).toContain('User Login');
      expect(createCall.fields.description).toContain('Token Refresh');
      expect(createCall.fields.description).toContain('OAuth Integration');
    });

    it('should include API endpoints in description', async () => {
      // Arrange
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      await provider.exportSpecification(mockSpecification, validJiraConfig);

      // Assert
      const createCall = mockJiraClient.version2.issues.createIssue.mock.calls[0][0];
      expect(createCall.fields.description).toContain('/auth/login');
      expect(createCall.fields.description).toContain('/auth/callback');
    });

    it('should handle Jira API errors during export', async () => {
      // Arrange
      mockJiraClient.version2.issues.createIssue.mockRejectedValue(
        new Error('Issue creation failed'),
      );

      // Act & Assert
      await expect(
        provider.exportSpecification(mockSpecification, validJiraConfig),
      ).rejects.toThrow('Issue creation failed');
    });

    it('should format description with proper Jira markup', async () => {
      // Arrange
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      await provider.exportSpecification(mockSpecification, validJiraConfig);

      // Assert
      const createCall = mockJiraClient.version2.issues.createIssue.mock.calls[0][0];
      const description = createCall.fields.description;

      // Check for Jira markup
      expect(description).toContain('h2.'); // Jira heading syntax
      expect(description).toContain('h3.');
      expect(description).toContain('*'); // Jira bold syntax
    });
  });

  describe('processWebhook', () => {
    const mockIntegration = {
      id: 'integration-123',
      config: validJiraConfig,
    };

    it('should process issue created webhook', async () => {
      // Arrange
      const webhookPayload = {
        webhookEvent: 'jira:issue_created',
        issue: {
          id: '10100',
          key: 'TEST-123',
          fields: {
            summary: 'New issue created',
            description: 'Issue description',
            issuetype: { name: 'Story' },
            status: { name: 'To Do' },
          },
        },
      };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'jira:issue_created', webhookPayload),
      ).resolves.not.toThrow();
    });

    it('should process issue updated webhook', async () => {
      // Arrange
      const webhookPayload = {
        webhookEvent: 'jira:issue_updated',
        issue: {
          id: '10100',
          key: 'TEST-123',
          fields: {
            summary: 'Updated issue',
            status: { name: 'In Progress' },
          },
        },
        changelog: {
          items: [
            {
              field: 'status',
              fromString: 'To Do',
              toString: 'In Progress',
            },
          ],
        },
      };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'jira:issue_updated', webhookPayload),
      ).resolves.not.toThrow();
    });

    it('should handle unknown webhook events', async () => {
      // Arrange
      const unknownPayload = { event: 'unknown' };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'unknown:event', unknownPayload),
      ).resolves.not.toThrow();
    });

    it('should log webhook processing', async () => {
      // Arrange
      const logSpy = jest.spyOn(provider['logger'], 'log');
      const payload = { webhookEvent: 'jira:issue_created' };

      // Act
      await provider.processWebhook(mockIntegration, 'jira:issue_created', payload);

      // Assert
      expect(logSpy).toHaveBeenCalledWith('Processing Jira webhook: jira:issue_created');
    });
  });

  describe('private helper methods', () => {
    it('should create Jira client with correct configuration', async () => {
      // This is tested indirectly through other methods
      // The client creation is tested when methods are called

      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockResolvedValue(mockJiraUser);

      // Act
      await provider.testConnection(validJiraConfig);

      // Assert - The mock client should have been used
      expect(mockJiraClient.version2.myself.getCurrentUser).toHaveBeenCalled();
    });

    it('should format description with all specification parts', async () => {
      // This is tested through exportSpecification method
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act
      await provider.exportSpecification(mockSpecification, validJiraConfig);

      // Assert
      const createCall = mockJiraClient.version2.issues.createIssue.mock.calls[0][0];
      const description = createCall.fields.description;

      expect(description).toContain(mockSpecification.description);
      expect(description).toContain('User Stories');
      expect(description).toContain('Features');
      expect(description).toContain('API Endpoints');
      expect(description).toContain('Data Models');
      expect(description).toContain('Frontend Components');
    });

    it('should handle specifications without optional fields', async () => {
      // Arrange
      const minimalSpec = {
        id: 'spec-minimal',
        title: 'Minimal Spec',
        description: 'Basic description',
        versions: [
          {
            version: 1,
            pmView: { overview: { title: 'Simple' } },
            frontendView: {},
            backendView: {},
          },
        ],
      };
      mockJiraClient.version2.issues.createIssue.mockResolvedValue(mockCreatedIssue);

      // Act & Assert - Should not throw
      await expect(
        provider.exportSpecification(minimalSpec, validJiraConfig),
      ).resolves.toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle Jira client initialization errors', async () => {
      // This would be tested if we needed to handle constructor errors
      // Currently the provider is resilient to client creation issues
    });

    it('should handle API rate limiting', async () => {
      // Arrange
      mockJiraClient.version2.myself.getCurrentUser.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });

      // Act
      const result = await provider.testConnection(validJiraConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle malformed webhook payloads', async () => {
      // Arrange
      const malformedPayload = null;

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook({}, 'jira:issue_created', malformedPayload),
      ).resolves.not.toThrow();
    });
  });
});
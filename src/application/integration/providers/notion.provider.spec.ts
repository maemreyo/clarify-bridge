// Test Notion integration provider functionality

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotionProvider } from './notion.provider';
import {
  IntegrationType,
  IntegrationConfig,
  NotionConfig,
  SyncResult,
  ExportResult,
} from '../interfaces/integration.interface';

// Mock Notion SDK
const mockNotionClient = {
  users: {
    me: jest.fn(),
    list: jest.fn(),
  },
  databases: {
    query: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  pages: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
  },
  blocks: {
    children: {
      list: jest.fn(),
      append: jest.fn(),
    },
  },
  search: jest.fn(),
};

jest.mock('@notionhq/client', () => ({
  Client: jest.fn().mockImplementation(() => mockNotionClient),
}));

describe('NotionProvider', () => {
  let provider: NotionProvider;
  let configService: jest.Mocked<ConfigService>;

  // Mock data
  const validNotionConfig: NotionConfig = {
    name: 'Notion Integration',
    description: 'Company Notion workspace integration',
    apiKey: 'secret_test123456789abcdef',
    databaseId: 'db123456-789a-bcde-f012-3456789abcde',
    workspaceId: 'workspace-456',
  };

  const invalidNotionConfig: Partial<NotionConfig> = {
    name: 'Invalid Notion',
    apiKey: '', // Empty API key
    // Missing databaseId
  };

  const mockSpecification = {
    id: 'spec-123',
    title: 'Real-time Chat Application',
    description: 'Build scalable real-time messaging system with WebSocket support',
    author: {
      id: 'user-456',
      name: 'Alex Johnson',
      email: 'alex@company.com',
    },
    team: {
      id: 'team-789',
      name: 'Full Stack Team',
    },
    status: 'APPROVED',
    versions: [
      {
        id: 'version-123',
        version: 1,
        pmView: {
          overview: {
            title: 'Chat Application',
            description: 'Real-time messaging platform',
          },
          userStories: [
            {
              id: 'US001',
              title: 'Send Messages',
              description: 'As a user, I want to send real-time messages',
              acceptanceCriteria: ['Message appears instantly', 'Support emoji and media'],
              priority: 'High',
            },
            {
              id: 'US002',
              title: 'Create Channels',
              description: 'As a user, I want to create chat channels',
              acceptanceCriteria: ['Public and private channels', 'Channel permissions'],
              priority: 'Medium',
            },
          ],
          features: [
            {
              id: 'F001',
              name: 'Real-time Messaging',
              description: 'WebSocket-based instant messaging',
              requirements: ['Message delivery', 'Online status', 'Typing indicators'],
            },
          ],
        },
        frontendView: {
          components: [
            {
              name: 'ChatWindow',
              type: 'component',
              description: 'Main chat interface component',
            },
            {
              name: 'MessageInput',
              type: 'component',
              description: 'Message composition and sending',
            },
          ],
          pages: [
            {
              name: 'ChatPage',
              path: '/chat/:channelId',
              description: 'Individual chat channel page',
            },
            {
              name: 'ChannelsPage',
              path: '/channels',
              description: 'Channel list and management',
            },
          ],
        },
        backendView: {
          apis: [
            {
              endpoint: '/api/messages',
              method: 'POST',
              description: 'Send new message',
            },
            {
              endpoint: '/api/channels',
              method: 'GET',
              description: 'Get user channels',
            },
          ],
          dataModels: [
            {
              name: 'Message',
              fields: [
                { name: 'id', type: 'UUID', required: true },
                { name: 'content', type: 'text', required: true },
                { name: 'authorId', type: 'UUID', required: true },
                { name: 'channelId', type: 'UUID', required: true },
              ],
            },
            {
              name: 'Channel',
              fields: [
                { name: 'id', type: 'UUID', required: true },
                { name: 'name', type: 'string', required: true },
                { name: 'isPrivate', type: 'boolean', required: false },
              ],
            },
          ],
        },
      },
    ],
  };

  const mockNotionUser = {
    object: 'user',
    id: 'user-notion-123',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    type: 'person',
    person: {
      email: 'test@company.com',
    },
  };

  const mockNotionDatabase = {
    object: 'database',
    id: 'db123456-789a-bcde-f012-3456789abcde',
    title: [
      {
        type: 'text',
        text: { content: 'Specifications Database' },
      },
    ],
    description: [
      {
        type: 'text',
        text: { content: 'Database for storing technical specifications' },
      },
    ],
    properties: {
      Title: { type: 'title' },
      Status: { type: 'select' },
      Priority: { type: 'select' },
      'Created At': { type: 'created_time' },
    },
  };

  const mockCreatedPage = {
    object: 'page',
    id: 'page-notion-456',
    url: 'https://notion.so/page-notion-456',
    properties: {
      Title: {
        title: [
          {
            text: { content: 'Real-time Chat Application' },
          },
        ],
      },
    },
  };

  const mockDatabasePages = {
    object: 'list',
    results: [
      {
        id: 'page-1',
        properties: {
          Title: { title: [{ text: { content: 'Existing Spec 1' } }] },
        },
      },
      {
        id: 'page-2',
        properties: {
          Title: { title: [{ text: { content: 'Existing Spec 2' } }] },
        },
      },
    ],
    has_more: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotionProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<NotionProvider>(NotionProvider);
    configService = module.get(ConfigService);

    // Reset all mocks
    jest.clearAllMocks();
    Object.values(mockNotionClient).forEach(api => {
      if (typeof api === 'object') {
        Object.values(api).forEach(method => {
          if (jest.isMockFunction(method)) {
            method.mockClear();
          }
        });
      } else if (jest.isMockFunction(api)) {
        api.mockClear();
      }
    });
  });

  describe('provider properties', () => {
    it('should have correct integration type', () => {
      expect(provider.type).toBe(IntegrationType.NOTION);
    });
  });

  describe('validateConfig', () => {
    it('should validate correct Notion config', async () => {
      // Arrange
      mockNotionClient.users.me.mockResolvedValue(mockNotionUser);
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);

      // Act
      const result = await provider.validateConfig(validNotionConfig);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject config with missing required fields', async () => {
      // Act
      const result = await provider.validateConfig(invalidNotionConfig as NotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject config with invalid API key format', async () => {
      // Arrange
      const configWithInvalidKey: NotionConfig = {
        ...validNotionConfig,
        apiKey: 'invalid-key-format',
      };

      // Act
      const result = await provider.validateConfig(configWithInvalidKey);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject config with invalid database ID format', async () => {
      // Arrange
      const configWithInvalidDb: NotionConfig = {
        ...validNotionConfig,
        databaseId: 'invalid-database-id',
      };

      // Act
      const result = await provider.validateConfig(configWithInvalidDb);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle test connection failure', async () => {
      // Arrange
      mockNotionClient.users.me.mockRejectedValue(new Error('Authentication failed'));

      // Act
      const result = await provider.validateConfig(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should validate API key format correctly', async () => {
      // Test various valid Notion API key formats
      const validKeys = [
        'secret_1234567890abcdef1234567890abcdef',
        'secret_aBcDeF1234567890',
      ];

      for (const key of validKeys) {
        const config = { ...validNotionConfig, apiKey: key };
        mockNotionClient.users.me.mockResolvedValue(mockNotionUser);
        mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);

        const result = await provider.validateConfig(config);
        expect(result).toBe(true);
      }
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      // Arrange
      mockNotionClient.users.me.mockResolvedValue(mockNotionUser);
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(mockNotionClient.users.me).toHaveBeenCalled();
      expect(mockNotionClient.databases.retrieve).toHaveBeenCalledWith({
        database_id: validNotionConfig.databaseId,
      });
      expect(result).toBe(true);
    });

    it('should handle authentication failure', async () => {
      // Arrange
      mockNotionClient.users.me.mockRejectedValue(new Error('401 Unauthorized'));

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle database not found', async () => {
      // Arrange
      mockNotionClient.users.me.mockResolvedValue(mockNotionUser);
      mockNotionClient.databases.retrieve.mockRejectedValue(new Error('Database not found'));

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle permission errors', async () => {
      // Arrange
      mockNotionClient.users.me.mockResolvedValue(mockNotionUser);
      mockNotionClient.databases.retrieve.mockRejectedValue(
        new Error('Insufficient permissions'),
      );

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle network timeouts', async () => {
      // Arrange
      mockNotionClient.users.me.mockRejectedValue(new Error('Request timeout'));

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('sync', () => {
    const mockIntegration = {
      id: 'integration-123',
      teamId: 'team-456',
      type: IntegrationType.NOTION,
      config: validNotionConfig,
      status: 'ACTIVE',
    };

    it('should perform sync successfully', async () => {
      // Arrange
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);
      mockNotionClient.databases.query.mockResolvedValue(mockDatabasePages);

      // Act
      const result = await provider.sync(mockIntegration);

      // Assert
      expect(result).toEqual({
        status: 'success',
        message: 'Notion sync completed successfully',
        syncedItems: expect.any(Number),
      });
      expect(mockNotionClient.databases.retrieve).toHaveBeenCalledWith({
        database_id: validNotionConfig.databaseId,
      });
    });

    it('should handle sync errors gracefully', async () => {
      // Arrange
      mockNotionClient.databases.retrieve.mockRejectedValue(new Error('Sync failed'));

      // Act
      const result = await provider.sync(mockIntegration);

      // Assert
      expect(result).toEqual({
        status: 'failed',
        message: 'Notion sync failed: Sync failed',
        syncedItems: 0,
        errors: ['Sync failed'],
      });
    });

    it('should sync database pages', async () => {
      // Arrange
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);
      mockNotionClient.databases.query.mockResolvedValue(mockDatabasePages);

      // Act
      await provider.sync(mockIntegration);

      // Assert
      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: validNotionConfig.databaseId,
        page_size: 100,
      });
    });

    it('should count synced items correctly', async () => {
      // Arrange
      const largeDatabasePages = {
        ...mockDatabasePages,
        results: Array(5).fill(mockDatabasePages.results[0]),
      };
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);
      mockNotionClient.databases.query.mockResolvedValue(largeDatabasePages);

      // Act
      const result = await provider.sync(mockIntegration);

      // Assert
      expect(result.syncedItems).toBe(6); // 1 database + 5 pages
    });

    it('should handle paginated results', async () => {
      // Arrange
      const firstPage = {
        ...mockDatabasePages,
        has_more: true,
        next_cursor: 'cursor-123',
      };
      const secondPage = {
        ...mockDatabasePages,
        has_more: false,
      };

      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);
      mockNotionClient.databases.query
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      // Act
      await provider.sync(mockIntegration);

      // Assert
      expect(mockNotionClient.databases.query).toHaveBeenCalledTimes(2);
      expect(mockNotionClient.databases.query).toHaveBeenLastCalledWith({
        database_id: validNotionConfig.databaseId,
        page_size: 100,
        start_cursor: 'cursor-123',
      });
    });
  });

  describe('exportSpecification', () => {
    it('should export specification as Notion page successfully', async () => {
      // Arrange
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      const result = await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      expect(mockNotionClient.pages.create).toHaveBeenCalledWith({
        parent: { database_id: validNotionConfig.databaseId },
        properties: {
          Title: {
            title: [
              {
                text: { content: mockSpecification.title },
              },
            ],
          },
          Status: {
            select: { name: 'Draft' },
          },
          Priority: {
            select: { name: 'Medium' },
          },
        },
        children: expect.any(Array),
      });

      expect(result).toEqual({
        externalId: mockCreatedPage.id,
        externalUrl: mockCreatedPage.url,
        provider: IntegrationType.NOTION,
        createdAt: expect.any(Date),
      });
    });

    it('should include specification content in page blocks', async () => {
      // Arrange
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const children = createCall.children;

      // Check for various content blocks
      expect(children).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            object: 'block',
            type: 'heading_2',
            heading_2: expect.objectContaining({
              rich_text: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.objectContaining({
                    content: expect.stringContaining('Description'),
                  }),
                }),
              ]),
            }),
          }),
        ]),
      );
    });

    it('should include user stories in page content', async () => {
      // Arrange
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const childrenText = JSON.stringify(createCall.children);

      expect(childrenText).toContain('Send Messages');
      expect(childrenText).toContain('Create Channels');
      expect(childrenText).toContain('Real-time Messaging');
    });

    it('should include API endpoints and data models', async () => {
      // Arrange
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const childrenText = JSON.stringify(createCall.children);

      expect(childrenText).toContain('/api/messages');
      expect(childrenText).toContain('/api/channels');
      expect(childrenText).toContain('Message');
      expect(childrenText).toContain('Channel');
    });

    it('should handle Notion API errors during export', async () => {
      // Arrange
      mockNotionClient.pages.create.mockRejectedValue(new Error('Page creation failed'));

      // Act & Assert
      await expect(
        provider.exportSpecification(mockSpecification, validNotionConfig),
      ).rejects.toThrow('Page creation failed');
    });

    it('should handle database property validation errors', async () => {
      // Arrange
      mockNotionClient.pages.create.mockRejectedValue({
        code: 'validation_error',
        message: 'Property validation failed',
      });

      // Act & Assert
      await expect(
        provider.exportSpecification(mockSpecification, validNotionConfig),
      ).rejects.toThrow();
    });

    it('should format content blocks correctly', async () => {
      // Arrange
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const children = createCall.children;

      // Verify block structure
      children.forEach(block => {
        expect(block).toHaveProperty('object', 'block');
        expect(block).toHaveProperty('type');
        expect(block).toHaveProperty(block.type);
      });
    });
  });

  describe('processWebhook', () => {
    const mockIntegration = {
      id: 'integration-123',
      config: validNotionConfig,
    };

    it('should process page created webhook', async () => {
      // Arrange
      const webhookPayload = {
        object: 'event',
        event_type: 'page_created',
        page: {
          id: 'page-123',
          object: 'page',
          parent: { database_id: validNotionConfig.databaseId },
          properties: {
            Title: { title: [{ text: { content: 'New Page' } }] },
          },
        },
      };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'page_created', webhookPayload),
      ).resolves.not.toThrow();
    });

    it('should process page updated webhook', async () => {
      // Arrange
      const webhookPayload = {
        object: 'event',
        event_type: 'page_updated',
        page: {
          id: 'page-123',
          object: 'page',
          properties: {
            Title: { title: [{ text: { content: 'Updated Page' } }] },
            Status: { select: { name: 'In Progress' } },
          },
        },
      };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'page_updated', webhookPayload),
      ).resolves.not.toThrow();
    });

    it('should process database updated webhook', async () => {
      // Arrange
      const webhookPayload = {
        object: 'event',
        event_type: 'database_updated',
        database: {
          id: validNotionConfig.databaseId,
          object: 'database',
          title: [{ text: { content: 'Updated Database' } }],
        },
      };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'database_updated', webhookPayload),
      ).resolves.not.toThrow();
    });

    it('should handle unknown webhook events', async () => {
      // Arrange
      const unknownPayload = { object: 'event', event_type: 'unknown' };

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook(mockIntegration, 'unknown', unknownPayload),
      ).resolves.not.toThrow();
    });

    it('should log webhook processing', async () => {
      // Arrange
      const logSpy = jest.spyOn(provider['logger'], 'log');
      const payload = { object: 'event', event_type: 'page_created' };

      // Act
      await provider.processWebhook(mockIntegration, 'page_created', payload);

      // Assert
      expect(logSpy).toHaveBeenCalledWith('Processing Notion webhook: page_created');
    });
  });

  describe('private helper methods', () => {
    it('should create Notion client with correct configuration', async () => {
      // This is tested indirectly through other methods
      // The client creation is tested when methods are called

      // Arrange
      mockNotionClient.users.me.mockResolvedValue(mockNotionUser);

      // Act
      await provider.testConnection(validNotionConfig);

      // Assert - The mock client should have been used
      expect(mockNotionClient.users.me).toHaveBeenCalled();
    });

    it('should format description with proper Notion blocks', async () => {
      // This is tested through exportSpecification method
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act
      await provider.exportSpecification(mockSpecification, validNotionConfig);

      // Assert
      const createCall = mockNotionClient.pages.create.mock.calls[0][0];
      const children = createCall.children;

      // Verify proper block formatting
      const hasTextBlocks = children.some(block => block.type === 'paragraph');
      const hasHeadings = children.some(block => block.type.startsWith('heading_'));

      expect(hasTextBlocks).toBe(true);
      expect(hasHeadings).toBe(true);
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
      mockNotionClient.pages.create.mockResolvedValue(mockCreatedPage);

      // Act & Assert - Should not throw
      await expect(
        provider.exportSpecification(minimalSpec, validNotionConfig),
      ).resolves.toBeDefined();
    });

    it('should validate Notion identifiers correctly', () => {
      // Test UUID format validation (used for database IDs)
      const validUUIDs = [
        'db123456-789a-bcde-f012-3456789abcde',
        '12345678-90ab-cdef-1234-567890abcdef',
      ];
      const invalidUUIDs = ['invalid-id', 'db123456', '123-456-789'];

      validUUIDs.forEach(id => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(uuidRegex.test(id.replace('db', ''))).toBe(true);
      });
    });
  });

  describe('error handling', () => {
    it('should handle Notion client initialization errors', async () => {
      // The provider should be resilient to client creation issues
      // This is handled gracefully in the implementation
    });

    it('should handle API rate limiting', async () => {
      // Arrange
      mockNotionClient.users.me.mockRejectedValue({
        code: 'rate_limited',
        message: 'Rate limit exceeded',
      });

      // Act
      const result = await provider.testConnection(validNotionConfig);

      // Assert
      expect(result).toBe(false);
    });

    it('should handle malformed webhook payloads', async () => {
      // Arrange
      const malformedPayload = null;

      // Act & Assert - Should not throw
      await expect(
        provider.processWebhook({}, 'page_created', malformedPayload),
      ).resolves.not.toThrow();
    });

    it('should handle partial sync failures', async () => {
      // Arrange
      mockNotionClient.databases.retrieve.mockResolvedValue(mockNotionDatabase);
      mockNotionClient.databases.query.mockRejectedValue(new Error('Query failed'));

      // Act
      const result = await provider.sync({
        id: 'integration-123',
        config: validNotionConfig,
      });

      // Assert
      expect(result.status).toBe('partial');
      expect(result.errors).toContain('Query failed');
    });

    it('should handle block creation errors during export', async () => {
      // Test error handling when creating page content blocks
      const specWithLargeContent = {
        ...mockSpecification,
        description: 'A'.repeat(10000), // Very long description
      };

      mockNotionClient.pages.create.mockRejectedValue({
        code: 'validation_error',
        message: 'Block content too large',
      });

      // Act & Assert
      await expect(
        provider.exportSpecification(specWithLargeContent, validNotionConfig),
      ).rejects.toThrow();
    });
  });
});
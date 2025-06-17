// UPDATED: 2025-06-17 - Added comprehensive vector database service tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VectorDbService } from './vector-db.service';
import { PrismaService } from '@core/database';
import { PineconeProvider } from './providers/pinecone.provider';
import { MemoryVectorProvider } from './providers/memory.provider';
import {
  VectorDocument,
  VectorSearchResult,
  VectorSearchOptions,
} from './interfaces/vector-provider.interface';

interface KnowledgeDocument {
  title?: string;
  content: string;
  type: 'specification' | 'context' | 'knowledge' | 'template';
  userId?: string;
  teamId?: string;
  specificationId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

describe('VectorDbService', () => {
  let service: VectorDbService;
  let configService: jest.Mocked<ConfigService>;
  let prismaService: jest.Mocked<PrismaService>;
  let pineconeProvider: jest.Mocked<PineconeProvider>;
  let memoryProvider: jest.Mocked<MemoryVectorProvider>;

  const mockUserId = 'user-123';
  const mockTeamId = 'team-456';
  const mockSpecId = 'spec-789';

  const mockSearchResult: VectorSearchResult = {
    id: 'vec-123',
    score: 0.95,
    metadata: {
      id: 'vec-123',
      type: 'specification',
      userId: mockUserId,
      teamId: mockTeamId,
      title: 'Test Specification',
      createdAt: new Date(),
    },
    content: 'Test specification content',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorDbService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            usageLog: {
              create: jest.fn(),
            },
            specification: {
              findUnique: jest.fn(),
            },
            specificationVersion: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: PineconeProvider,
          useValue: {
            name: 'pinecone',
            initialize: jest.fn(),
            upsert: jest.fn(),
            search: jest.fn(),
            searchByText: jest.fn(),
            delete: jest.fn(),
            deleteByFilter: jest.fn(),
            fetch: jest.fn(),
            isAvailable: jest.fn(),
          },
        },
        {
          provide: MemoryVectorProvider,
          useValue: {
            name: 'memory',
            initialize: jest.fn(),
            upsert: jest.fn(),
            search: jest.fn(),
            searchByText: jest.fn(),
            delete: jest.fn(),
            deleteByFilter: jest.fn(),
            fetch: jest.fn(),
            isAvailable: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VectorDbService>(VectorDbService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
    pineconeProvider = module.get(PineconeProvider);
    memoryProvider = module.get(MemoryVectorProvider);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('onModuleInit - Provider Selection', () => {
    it('should use Pinecone provider when configured and available', async () => {
      // Arrange
      configService.get.mockReturnValue('pinecone');
      pineconeProvider.isAvailable.mockResolvedValue(true);
      pineconeProvider.initialize.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(configService.get).toHaveBeenCalledWith('VECTOR_DB_PROVIDER', 'memory');
      expect(pineconeProvider.isAvailable).toHaveBeenCalled();
      expect(pineconeProvider.initialize).toHaveBeenCalled();
      expect((service as any).provider).toBe(pineconeProvider);
    });

    it('should fallback to memory provider when Pinecone unavailable', async () => {
      // Arrange
      configService.get.mockReturnValue('pinecone');
      pineconeProvider.isAvailable.mockResolvedValue(false);
      memoryProvider.initialize.mockResolvedValue(undefined);
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

      // Act
      await service.onModuleInit();

      // Assert
      expect(pineconeProvider.isAvailable).toHaveBeenCalled();
      expect(memoryProvider.initialize).toHaveBeenCalled();
      expect((service as any).provider).toBe(memoryProvider);
      expect(loggerSpy).toHaveBeenCalledWith(
        'Pinecone not available, falling back to memory provider'
      );
    });

    it('should use memory provider when configured as default', async () => {
      // Arrange
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(memoryProvider.initialize).toHaveBeenCalled();
      expect((service as any).provider).toBe(memoryProvider);
      expect(pineconeProvider.isAvailable).not.toHaveBeenCalled();
    });

    it('should default to memory provider for unknown configuration', async () => {
      // Arrange
      configService.get.mockReturnValue('unknown-provider');
      memoryProvider.initialize.mockResolvedValue(undefined);

      // Act
      await service.onModuleInit();

      // Assert
      expect(memoryProvider.initialize).toHaveBeenCalled();
      expect((service as any).provider).toBe(memoryProvider);
    });

    it('should log the selected provider', async () => {
      // Arrange
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

      // Act
      await service.onModuleInit();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Using vector provider: memory');
    });
  });

  describe('storeDocument', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should store a knowledge document successfully', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        title: 'Test Document',
        content: 'This is test content for knowledge storage',
        type: 'knowledge',
        userId: mockUserId,
        teamId: mockTeamId,
        tags: ['testing', 'knowledge'],
        metadata: { category: 'technical' },
      };

      memoryProvider.upsert.mockResolvedValue(undefined);
      prismaService.usageLog.create.mockResolvedValue({} as any);

      // Act
      const result = await service.storeDocument(document);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.stringMatching(/^kno_/), // Generated ID with knowledge prefix
          content: document.content,
          metadata: expect.objectContaining({
            type: 'knowledge',
            userId: mockUserId,
            teamId: mockTeamId,
            title: 'Test Document',
            tags: ['testing', 'knowledge'],
            category: 'technical',
            createdAt: expect.any(Date),
          }),
        }),
      ]);

      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          teamId: mockTeamId,
          action: 'vector_stored',
          metadata: { documentId: result, type: 'knowledge' },
        },
      });

      expect(result).toMatch(/^kno_/);
    });

    it('should store specification document without optional fields', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        content: 'Minimal specification content',
        type: 'specification',
        specificationId: mockSpecId,
      };

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const result = await service.storeDocument(document);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: 'Minimal specification content',
          metadata: expect.objectContaining({
            type: 'specification',
            specificationId: mockSpecId,
            userId: undefined,
            teamId: undefined,
            title: undefined,
            tags: undefined,
          }),
        }),
      ]);

      expect(prismaService.usageLog.create).not.toHaveBeenCalled();
      expect(result).toMatch(/^spe_/);
    });

    it('should handle context documents with attachments', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        title: 'Context with Attachments',
        content: 'Context content with file references',
        type: 'context',
        userId: mockUserId,
        teamId: mockTeamId,
        specificationId: mockSpecId,
        metadata: {
          hasAttachments: true,
          attachmentCount: 3,
          attachmentTypes: ['pdf', 'docx', 'image'],
        },
      };

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const result = await service.storeDocument(document);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'context',
            hasAttachments: true,
            attachmentCount: 3,
            attachmentTypes: ['pdf', 'docx', 'image'],
          }),
        }),
      ]);

      expect(result).toMatch(/^con_/);
    });

    it('should handle template documents', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        title: 'Template Document',
        content: 'Template content for reuse',
        type: 'template',
        teamId: mockTeamId,
        tags: ['template', 'reusable'],
      };

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const result = await service.storeDocument(document);

      // Assert
      expect(result).toMatch(/^tem_/);
    });

    it('should handle provider upsert failure', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        content: 'Test content',
        type: 'knowledge',
      };

      const error = new Error('Vector storage failed');
      memoryProvider.upsert.mockRejectedValue(error);

      // Act & Assert
      await expect(service.storeDocument(document)).rejects.toThrow('Vector storage failed');
      expect(prismaService.usageLog.create).not.toHaveBeenCalled();
    });
  });

  describe('storeDocuments', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should store multiple documents successfully', async () => {
      // Arrange
      const documents: KnowledgeDocument[] = [
        {
          title: 'Doc 1',
          content: 'Content 1',
          type: 'knowledge',
          userId: mockUserId,
        },
        {
          title: 'Doc 2',
          content: 'Content 2',
          type: 'specification',
          teamId: mockTeamId,
        },
        {
          title: 'Doc 3',
          content: 'Content 3',
          type: 'context',
          userId: mockUserId,
          teamId: mockTeamId,
        },
      ];

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const results = await service.storeDocuments(documents);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Content 1' }),
          expect.objectContaining({ content: 'Content 2' }),
          expect.objectContaining({ content: 'Content 3' }),
        ])
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toMatch(/^kno_/);
      expect(results[1]).toMatch(/^spe_/);
      expect(results[2]).toMatch(/^con_/);
    });

    it('should handle empty document array', async () => {
      // Arrange
      const documents: KnowledgeDocument[] = [];
      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const results = await service.storeDocuments(documents);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should search similar documents by text', async () => {
      // Arrange
      const query = 'test query for similarity search';
      const options: VectorSearchOptions & { userId?: string; teamId?: string } = {
        topK: 5,
        userId: mockUserId,
        teamId: mockTeamId,
      };

      memoryProvider.searchByText.mockResolvedValue([mockSearchResult]);
      prismaService.usageLog.create.mockResolvedValue({} as any);

      // Act
      const results = await service.searchSimilar(query, options);

      // Assert
      expect(memoryProvider.searchByText).toHaveBeenCalledWith(query, {
        topK: 5,
        filter: {
          userId: mockUserId,
          teamId: mockTeamId,
        },
      });

      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          teamId: mockTeamId,
          action: 'vector_search',
          metadata: { query, resultsCount: 1 },
        },
      });

      expect(results).toEqual([mockSearchResult]);
    });

    it('should search with type filter', async () => {
      // Arrange
      const query = 'specification content';
      const options = {
        type: ['specification', 'context'],
        topK: 10,
      };

      memoryProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.searchSimilar(query, options);

      // Assert
      expect(memoryProvider.searchByText).toHaveBeenCalledWith(query, {
        topK: 10,
        filter: {
          type: ['specification', 'context'],
        },
      });

      expect(results).toEqual([mockSearchResult]);
    });

    it('should search with single type filter', async () => {
      // Arrange
      const query = 'knowledge search';
      const options = {
        type: 'knowledge',
        userId: mockUserId,
      };

      memoryProvider.searchByText.mockResolvedValue([]);

      // Act
      await service.searchSimilar(query, options);

      // Assert
      expect(memoryProvider.searchByText).toHaveBeenCalledWith(query, {
        filter: {
          type: 'knowledge',
          userId: mockUserId,
        },
      });
    });

    it('should not track usage when no user/team provided', async () => {
      // Arrange
      const query = 'anonymous search';
      memoryProvider.searchByText.mockResolvedValue([]);

      // Act
      await service.searchSimilar(query);

      // Assert
      expect(prismaService.usageLog.create).not.toHaveBeenCalled();
      expect(memoryProvider.searchByText).toHaveBeenCalledWith(query, {});
    });

    it('should handle search errors gracefully', async () => {
      // Arrange
      const query = 'error search';
      const error = new Error('Search service unavailable');
      memoryProvider.searchByText.mockRejectedValue(error);

      // Act & Assert
      await expect(service.searchSimilar(query)).rejects.toThrow('Search service unavailable');
      expect(prismaService.usageLog.create).not.toHaveBeenCalled();
    });

    it('should handle empty search results', async () => {
      // Arrange
      const query = 'no results query';
      memoryProvider.searchByText.mockResolvedValue([]);
      prismaService.usageLog.create.mockResolvedValue({} as any);

      // Act
      const results = await service.searchSimilar(query, { userId: mockUserId });

      // Assert
      expect(results).toEqual([]);
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          teamId: undefined,
          action: 'vector_search',
          metadata: { query, resultsCount: 0 },
        },
      });
    });
  });

  describe('getRelatedSpecifications', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should get related specifications by ID', async () => {
      // Arrange
      const specificationId = mockSpecId;
      const options = { limit: 5, teamId: mockTeamId };

      const mockSpec = {
        id: specificationId,
        title: 'Source Specification',
        description: 'Source spec description',
        versions: [
          {
            id: 'ver-1',
            pmView: { overview: 'PM overview' },
            frontendView: { framework: 'React' },
            backendView: { architecture: 'Microservices' },
          },
        ],
      };

      prismaService.specification.findUnique.mockResolvedValue(mockSpec as any);
      memoryProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.getRelatedSpecifications(specificationId, options);

      // Assert
      expect(prismaService.specification.findUnique).toHaveBeenCalledWith({
        where: { id: specificationId },
        include: { versions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      expect(memoryProvider.searchByText).toHaveBeenCalledWith(
        expect.stringContaining('PM overview'),
        {
          topK: 5,
          filter: {
            type: 'specification',
            teamId: mockTeamId,
          },
        }
      );

      expect(results).toEqual([mockSearchResult]);
    });

    it('should handle specification not found', async () => {
      // Arrange
      const specificationId = 'non-existent-spec';
      prismaService.specification.findUnique.mockResolvedValue(null);

      // Act
      const results = await service.getRelatedSpecifications(specificationId);

      // Assert
      expect(results).toEqual([]);
      expect(memoryProvider.searchByText).not.toHaveBeenCalled();
    });

    it('should handle specification without versions', async () => {
      // Arrange
      const specificationId = mockSpecId;
      const mockSpec = {
        id: specificationId,
        title: 'Spec Without Versions',
        description: 'No versions available',
        versions: [],
      };

      prismaService.specification.findUnique.mockResolvedValue(mockSpec as any);

      // Act
      const results = await service.getRelatedSpecifications(specificationId);

      // Assert
      expect(results).toEqual([]);
      expect(memoryProvider.searchByText).not.toHaveBeenCalled();
    });
  });

  describe('storeSpecification', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should store specification with version content', async () => {
      // Arrange
      const specification = {
        id: mockSpecId,
        title: 'Test Specification',
        description: 'Test specification description',
      };

      const version = {
        id: 'ver-123',
        pmView: { overview: 'PM view content' },
        frontendView: { framework: 'React', components: ['Header', 'Footer'] },
        backendView: { services: ['API', 'Auth'] },
      };

      memoryProvider.upsert.mockResolvedValue(undefined);
      prismaService.usageLog.create.mockResolvedValue({} as any);

      // Act
      const result = await service.storeSpecification(
        specification,
        version,
        mockUserId,
        mockTeamId
      );

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: expect.stringContaining('PM view content'),
          metadata: expect.objectContaining({
            type: 'specification',
            specificationId: mockSpecId,
            versionId: 'ver-123',
            userId: mockUserId,
            teamId: mockTeamId,
            title: 'Test Specification',
          }),
        }),
      ]);

      expect(result).toMatch(/^spe_/);
    });
  });

  describe('storeKnowledge', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should store team knowledge', async () => {
      // Arrange
      const title = 'Team Guidelines';
      const content = 'Team coding and process guidelines';
      const tags = ['guidelines', 'process', 'team'];

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const result = await service.storeKnowledge(title, content, mockTeamId, tags);

      // Assert
      expect(memoryProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content,
          metadata: expect.objectContaining({
            type: 'knowledge',
            teamId: mockTeamId,
            title,
            tags,
          }),
        }),
      ]);

      expect(result).toMatch(/^kno_/);
    });
  });

  describe('searchTeamKnowledge', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should search team-specific knowledge', async () => {
      // Arrange
      const query = 'team processes';
      const options = { topK: 3 };
      memoryProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.searchTeamKnowledge(mockTeamId, query, options);

      // Assert
      expect(memoryProvider.searchByText).toHaveBeenCalledWith(query, {
        topK: 3,
        teamId: mockTeamId,
        type: 'knowledge',
      });

      expect(results).toEqual([mockSearchResult]);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should log cleanup not implemented message', async () => {
      // Arrange
      const olderThan = new Date('2024-01-01');
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

      // Act
      await service.cleanup(olderThan);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Vector cleanup not implemented for current provider'
      );
    });
  });

  describe('generateDocumentId', () => {
    it('should generate IDs with correct prefixes', () => {
      // Arrange & Act
      const knowledgeId = (service as any).generateDocumentId({ type: 'knowledge' });
      const specificationId = (service as any).generateDocumentId({ type: 'specification' });
      const contextId = (service as any).generateDocumentId({ type: 'context' });
      const templateId = (service as any).generateDocumentId({ type: 'template' });

      // Assert
      expect(knowledgeId).toMatch(/^kno_/);
      expect(specificationId).toMatch(/^spe_/);
      expect(contextId).toMatch(/^con_/);
      expect(templateId).toMatch(/^tem_/);
    });

    it('should generate unique IDs', () => {
      // Arrange & Act
      const id1 = (service as any).generateDocumentId({ type: 'knowledge' });
      const id2 = (service as any).generateDocumentId({ type: 'knowledge' });

      // Assert
      expect(id1).not.toBe(id2);
    });
  });

  describe('extractSpecificationContent', () => {
    it('should extract and combine content from all views', () => {
      // Arrange
      const version = {
        pmView: { overview: 'PM overview', goals: ['Goal 1', 'Goal 2'] },
        frontendView: { framework: 'React', components: ['Header'] },
        backendView: { architecture: 'Microservices', database: 'PostgreSQL' },
      };

      // Act
      const result = (service as any).extractSpecificationContent(version);

      // Assert
      expect(result).toContain('PM overview');
      expect(result).toContain('React');
      expect(result).toContain('Microservices');
      expect(result).toContain('PostgreSQL');
      expect(result.split('\n\n')).toHaveLength(3); // Three views separated by double newlines
    });

    it('should handle missing views gracefully', () => {
      // Arrange
      const version = {
        pmView: { overview: 'Only PM view' },
        frontendView: null,
        backendView: undefined,
      };

      // Act
      const result = (service as any).extractSpecificationContent(version);

      // Assert
      expect(result).toContain('Only PM view');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should handle empty version object', () => {
      // Arrange
      const version = {};

      // Act
      const result = (service as any).extractSpecificationContent(version);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(async () => {
      configService.get.mockReturnValue('memory');
      memoryProvider.initialize.mockResolvedValue(undefined);
      await service.onModuleInit();
    });

    it('should handle provider initialization failure', async () => {
      // Arrange
      const error = new Error('Provider initialization failed');
      memoryProvider.initialize.mockRejectedValue(error);

      // Act & Assert
      await expect(service.onModuleInit()).rejects.toThrow('Provider initialization failed');
    });

    it('should handle usage logging failures gracefully', async () => {
      // Arrange
      const document: KnowledgeDocument = {
        content: 'Test content',
        type: 'knowledge',
        userId: mockUserId,
      };

      memoryProvider.upsert.mockResolvedValue(undefined);
      prismaService.usageLog.create.mockRejectedValue(new Error('Logging failed'));

      // Act & Assert
      // Should not throw error even if usage logging fails
      const result = await service.storeDocument(document);
      expect(result).toMatch(/^kno_/);
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      const documents: KnowledgeDocument[] = Array.from({ length: 5 }, (_, i) => ({
        title: `Doc ${i}`,
        content: `Content ${i}`,
        type: 'knowledge',
        userId: mockUserId,
      }));

      memoryProvider.upsert.mockResolvedValue(undefined);

      // Act
      const promises = documents.map(doc => service.storeDocument(doc));
      const results = await Promise.all(promises);

      // Assert
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toMatch(/^kno_/);
      });
      expect(memoryProvider.upsert).toHaveBeenCalledTimes(5);
    });
  });
});
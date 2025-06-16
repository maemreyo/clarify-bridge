import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VectorDbService } from './vector-db.service';
import { PrismaService } from '@core/database';
import { LlmCoreService } from '@core/llm';
import { PineconeProvider } from './providers/pinecone.provider';
import { MemoryVectorProvider } from './providers/memory.provider';
import {
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetadata,
} from './interfaces/vector-provider.interface';

describe('VectorDbService', () => {
  let service: VectorDbService;
  let prismaService: jest.Mocked<PrismaService>;
  let llmService: jest.Mocked<LlmCoreService>;
  let configService: jest.Mocked<ConfigService>;
  let pineconeProvider: jest.Mocked<PineconeProvider>;
  let memoryProvider: jest.Mocked<MemoryVectorProvider>;

  const mockEmbedding = {
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    model: 'text-embedding-ada-002',
    provider: 'OpenAI',
  };

  const mockDocument: VectorDocument = {
    id: 'doc-123',
    content: 'Test document content',
    embedding: mockEmbedding.embedding,
    metadata: {
      id: 'doc-123',
      type: 'specification',
      userId: 'user-123',
      teamId: 'team-123',
      specificationId: 'spec-123',
      title: 'Test Specification',
      createdAt: new Date(),
    },
  };

  const mockSearchResult: VectorSearchResult = {
    id: 'doc-123',
    score: 0.95,
    metadata: mockDocument.metadata,
    content: mockDocument.content,
  };

  const mockSpecification = {
    id: 'spec-123',
    title: 'Test Spec',
    description: 'Test description',
    author: {
      id: 'user-123',
      name: 'Test User',
    },
    versions: [
      {
        id: 'version-123',
        version: 1,
        pmView: { content: 'PM view content' },
        frontendView: { content: 'Frontend view content' },
        backendView: { content: 'Backend view content' },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorDbService,
        {
          provide: PrismaService,
          useValue: {
            specification: {
              findUnique: jest.fn(),
            },
            usageLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: LlmCoreService,
          useValue: {
            generateEmbedding: jest.fn(),
            generateEmbeddings: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PineconeProvider,
          useValue: {
            name: 'pinecone',
            initialize: jest.fn(),
            isAvailable: jest.fn(),
            upsert: jest.fn(),
            search: jest.fn(),
            searchByText: jest.fn(),
            delete: jest.fn(),
            deleteByFilter: jest.fn(),
            fetch: jest.fn(),
          },
        },
        {
          provide: MemoryVectorProvider,
          useValue: {
            name: 'memory',
            initialize: jest.fn(),
            isAvailable: jest.fn(),
            upsert: jest.fn(),
            search: jest.fn(),
            searchByText: jest.fn(),
            delete: jest.fn(),
            deleteByFilter: jest.fn(),
            fetch: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VectorDbService>(VectorDbService);
    prismaService = module.get(PrismaService);
    llmService = module.get(LlmCoreService);
    configService = module.get(ConfigService);
    pineconeProvider = module.get(PineconeProvider);
    memoryProvider = module.get(MemoryVectorProvider);

    // Default configuration
    configService.get.mockImplementation((key: string) => {
      if (key === 'VECTOR_DB_PROVIDER') return 'pinecone';
      return null;
    });

    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize pinecone provider when configured', async () => {
      // Arrange
      pineconeProvider.isAvailable.mockResolvedValue(true);

      // Act
      await service.onModuleInit();

      // Assert
      expect(pineconeProvider.initialize).toHaveBeenCalled();
      expect(pineconeProvider.isAvailable).toHaveBeenCalled();
    });

    it('should fallback to memory provider if pinecone not available', async () => {
      // Arrange
      pineconeProvider.isAvailable.mockResolvedValue(false);
      memoryProvider.isAvailable.mockResolvedValue(true);

      // Act
      await service.onModuleInit();

      // Assert
      expect(memoryProvider.initialize).toHaveBeenCalled();
    });

    it('should use memory provider when configured', async () => {
      // Arrange
      configService.get.mockReturnValue('memory');
      memoryProvider.isAvailable.mockResolvedValue(true);

      // Act
      await service.onModuleInit();

      // Assert
      expect(memoryProvider.initialize).toHaveBeenCalled();
      expect(pineconeProvider.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization failure gracefully', async () => {
      // Arrange
      pineconeProvider.isAvailable.mockResolvedValue(true);
      pineconeProvider.initialize.mockRejectedValue(new Error('Init failed'));

      // Act & Assert - should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('storeDocument', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should store document with generated embedding', async () => {
      // Arrange
      const document = {
        title: 'Test Document',
        content: 'Test content',
        type: 'specification' as const,
        userId: 'user-123',
        teamId: 'team-123',
        specificationId: 'spec-123',
      };
      llmService.generateEmbedding.mockResolvedValue(mockEmbedding);
      pineconeProvider.upsert.mockResolvedValue(undefined);

      // Act
      const result = await service.storeDocument(document);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(
        `${document.title}\n\n${document.content}`,
      );
      expect(pineconeProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.stringMatching(/^spe_/),
          content: document.content,
          embedding: mockEmbedding.embedding,
          metadata: expect.objectContaining({
            type: document.type,
            userId: document.userId,
            teamId: document.teamId,
            title: document.title,
          }),
        }),
      ]);
      expect(result).toMatch(/^spe_/);
    });

    it('should handle missing optional fields', async () => {
      // Arrange
      const minimalDocument = {
        content: 'Content only',
        type: 'knowledge' as const,
      };
      llmService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      await service.storeDocument(minimalDocument);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith('Content only');
      expect(pineconeProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          content: minimalDocument.content,
          metadata: expect.objectContaining({
            type: minimalDocument.type,
          }),
        }),
      ]);
    });
  });

  describe('storeDocuments', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should store multiple documents in batch', async () => {
      // Arrange
      const documents = [
        { content: 'Doc 1', type: 'specification' as const },
        { content: 'Doc 2', type: 'context' as const },
      ];
      llmService.generateEmbeddings.mockResolvedValue([mockEmbedding, mockEmbedding]);

      // Act
      const result = await service.storeDocuments(documents);

      // Assert
      expect(llmService.generateEmbeddings).toHaveBeenCalledWith(['Doc 1', 'Doc 2']);
      expect(pineconeProvider.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Doc 1' }),
          expect.objectContaining({ content: 'Doc 2' }),
        ]),
      );
      expect(result).toHaveLength(2);
    });

    it('should handle empty document array', async () => {
      // Act
      const result = await service.storeDocuments([]);

      // Assert
      expect(llmService.generateEmbeddings).not.toHaveBeenCalled();
      expect(pineconeProvider.upsert).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('storeContext', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should store specification context', async () => {
      // Arrange
      const context = {
        requirements: 'User requirements',
        attachments: ['file1.pdf', 'file2.doc'],
        references: ['https://example.com'],
      };
      llmService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await service.storeContext('spec-123', 'user-123', 'team-123', context);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('Requirements:\nUser requirements'),
      );
      expect(pineconeProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'context',
            specificationId: 'spec-123',
            hasAttachments: true,
            attachmentCount: 2,
          }),
        }),
      ]);
      expect(result).toMatch(/^con_/);
    });
  });

  describe('searchSimilar', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should search similar documents by text', async () => {
      // Arrange
      const query = 'test query';
      const options = {
        topK: 5,
        userId: 'user-123',
        teamId: 'team-123',
      };
      pineconeProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.searchSimilar(query, options);

      // Assert
      expect(pineconeProvider.searchByText).toHaveBeenCalledWith(query, {
        topK: 5,
        filter: {
          userId: 'user-123',
          teamId: 'team-123',
        },
      });
      expect(prismaService.usageLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          teamId: 'team-123',
          action: 'vector_search',
          metadata: { query, resultsCount: 1 },
        },
      });
      expect(results).toEqual([mockSearchResult]);
    });

    it('should handle search with type filter', async () => {
      // Arrange
      const options = {
        type: ['specification', 'context'],
      };
      pineconeProvider.searchByText.mockResolvedValue([]);

      // Act
      await service.searchSimilar('query', options);

      // Assert
      expect(pineconeProvider.searchByText).toHaveBeenCalledWith('query', {
        filter: {
          type: ['specification', 'context'],
        },
      });
    });

    it('should not track usage when no user/team provided', async () => {
      // Arrange
      pineconeProvider.searchByText.mockResolvedValue([]);

      // Act
      await service.searchSimilar('query');

      // Assert
      expect(prismaService.usageLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getRelatedSpecifications', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should find related specifications', async () => {
      // Arrange
      pineconeProvider.fetch.mockResolvedValue([mockDocument]);
      pineconeProvider.search.mockResolvedValue([
        { ...mockSearchResult, id: 'spec-456', metadata: { ...mockSearchResult.metadata, specificationId: 'spec-456' } },
        { ...mockSearchResult, id: 'spec-789', metadata: { ...mockSearchResult.metadata, specificationId: 'spec-789' } },
      ]);

      // Act
      const results = await service.getRelatedSpecifications('spec-123', { limit: 5 });

      // Assert
      expect(pineconeProvider.fetch).toHaveBeenCalledWith(['spec-123']);
      expect(pineconeProvider.search).toHaveBeenCalledWith(
        mockEmbedding.embedding,
        expect.objectContaining({
          topK: 6, // limit + 1
          filter: expect.objectContaining({
            type: 'specification',
          }),
        }),
      );
      expect(results).toEqual(['spec-456', 'spec-789']);
    });

    it('should filter by teamId if provided', async () => {
      // Arrange
      pineconeProvider.fetch.mockResolvedValue([mockDocument]);
      pineconeProvider.search.mockResolvedValue([]);

      // Act
      await service.getRelatedSpecifications('spec-123', { teamId: 'team-123' });

      // Assert
      expect(pineconeProvider.search).toHaveBeenCalledWith(
        mockEmbedding.embedding,
        expect.objectContaining({
          filter: expect.objectContaining({
            teamId: 'team-123',
          }),
        }),
      );
    });

    it('should return empty array if document not found', async () => {
      // Arrange
      pineconeProvider.fetch.mockResolvedValue([]);

      // Act
      const results = await service.getRelatedSpecifications('non-existent');

      // Assert
      expect(results).toEqual([]);
      expect(pineconeProvider.search).not.toHaveBeenCalled();
    });
  });

  describe('storeSpecificationVersion', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should store specification version with all views', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(mockSpecification);
      llmService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await service.storeSpecificationVersion('spec-123', 1);

      // Assert
      expect(prismaService.specification.findUnique).toHaveBeenCalledWith({
        where: { id: 'spec-123' },
        include: {
          author: true,
          versions: {
            where: { version: 1 },
            take: 1,
          },
        },
      });
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(
        expect.stringContaining('PM view content'),
      );
      expect(pineconeProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'specification',
            specificationId: 'spec-123',
            version: 1,
            authorName: 'Test User',
          }),
        }),
      ]);
      expect(result).toMatch(/^spe_/);
    });

    it('should handle missing specification', async () => {
      // Arrange
      prismaService.specification.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.storeSpecificationVersion('non-existent', 1)).rejects.toThrow(
        'Specification not found',
      );
    });

    it('should handle missing version', async () => {
      // Arrange
      const specWithoutVersion = {
        ...mockSpecification,
        versions: [],
      };
      prismaService.specification.findUnique.mockResolvedValue(specWithoutVersion);

      // Act & Assert
      await expect(service.storeSpecificationVersion('spec-123', 999)).rejects.toThrow(
        'Specification version not found',
      );
    });
  });

  describe('deleteSpecificationVectors', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should delete all vectors for specification', async () => {
      // Arrange
      pineconeProvider.deleteByFilter.mockResolvedValue(undefined);

      // Act
      await service.deleteSpecificationVectors('spec-123');

      // Assert
      expect(pineconeProvider.deleteByFilter).toHaveBeenCalledWith({
        specificationId: 'spec-123',
      });
    });
  });

  describe('storeKnowledge', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should store team knowledge', async () => {
      // Arrange
      const title = 'Team Guidelines';
      const content = 'Our coding standards...';
      const teamId = 'team-123';
      const tags = ['guidelines', 'standards'];

      llmService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Act
      const result = await service.storeKnowledge(title, content, teamId, tags);

      // Assert
      expect(pineconeProvider.upsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.objectContaining({
            type: 'knowledge',
            teamId,
            tags,
            title,
          }),
        }),
      ]);
      expect(result).toMatch(/^kno_/);
    });
  });

  describe('searchTeamKnowledge', () => {
    beforeEach(async () => {
      pineconeProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();
    });

    it('should search team knowledge base', async () => {
      // Arrange
      const teamId = 'team-123';
      const query = 'coding standards';
      pineconeProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.searchTeamKnowledge(teamId, query, { topK: 10 });

      // Assert
      expect(pineconeProvider.searchByText).toHaveBeenCalledWith(query, {
        topK: 10,
        filter: {
          teamId,
          type: 'knowledge',
        },
      });
      expect(results).toEqual([mockSearchResult]);
    });
  });

  describe('provider fallback', () => {
    it('should handle provider not available', async () => {
      // Arrange
      pineconeProvider.isAvailable.mockResolvedValue(false);
      memoryProvider.isAvailable.mockResolvedValue(false);

      // Act
      await service.onModuleInit();

      // Assert - should not throw but service won't work
      expect(service['provider']).toBeUndefined();
    });

    it('should work with memory provider', async () => {
      // Arrange
      configService.get.mockReturnValue('memory');
      memoryProvider.isAvailable.mockResolvedValue(true);
      await service.onModuleInit();

      memoryProvider.searchByText.mockResolvedValue([mockSearchResult]);

      // Act
      const results = await service.searchSimilar('query');

      // Assert
      expect(memoryProvider.searchByText).toHaveBeenCalled();
      expect(results).toEqual([mockSearchResult]);
    });
  });
});
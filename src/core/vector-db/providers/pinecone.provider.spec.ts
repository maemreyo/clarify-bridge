import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeProvider } from './pinecone.provider';
import { LlmCoreService } from '@core/llm';
import {
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
} from '../interfaces/vector-provider.interface';

// Mock Pinecone SDK
jest.mock('@pinecone-database/pinecone');

describe('PineconeProvider', () => {
  let provider: PineconeProvider;
  let configService: jest.Mocked<ConfigService>;
  let llmService: jest.Mocked<LlmCoreService>;
  let mockPineconeClient: jest.Mocked<Pinecone>;
  let mockIndex: any;

  const mockEmbedding = Array.from({ length: 1536 }, () => Math.random());

  const mockVectorDocument: VectorDocument = {
    id: 'doc-123',
    content: 'Test document content for vector storage',
    embedding: mockEmbedding,
    metadata: {
      id: 'doc-123',
      type: 'specification',
      userId: 'user-123',
      teamId: 'team-456',
      title: 'Test Document',
      tags: ['test', 'spec'],
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
  };

  const mockSearchResults = [
    {
      id: 'doc-123',
      score: 0.95,
      values: mockEmbedding,
      metadata: mockVectorDocument.metadata,
    },
    {
      id: 'doc-456',
      score: 0.87,
      values: Array.from({ length: 1536 }, () => Math.random()),
      metadata: {
        id: 'doc-456',
        type: 'context',
        title: 'Another Document',
        createdAt: new Date('2024-01-14T10:00:00Z'),
      },
    },
  ];

  beforeEach(async () => {
    // Create mock index
    mockIndex = {
      upsert: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ matches: mockSearchResults }),
      deleteMany: jest.fn().mockResolvedValue({}),
      fetch: jest.fn().mockResolvedValue({
        vectors: {
          'doc-123': {
            id: 'doc-123',
            values: mockEmbedding,
            metadata: mockVectorDocument.metadata,
          },
        },
      }),
      describeIndexStats: jest.fn().mockResolvedValue({ totalVectorCount: 100 }),
    };

    // Create mock Pinecone client
    mockPineconeClient = {
      listIndexes: jest.fn().mockResolvedValue({
        indexes: [{ name: 'clarity-bridge' }],
      }),
      createIndex: jest.fn().mockResolvedValue({}),
      index: jest.fn().mockReturnValue(mockIndex),
    } as any;

    // Mock the Pinecone constructor
    (Pinecone as jest.MockedClass<typeof Pinecone>).mockImplementation(() => mockPineconeClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PineconeProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                PINECONE_API_KEY: 'test-api-key',
                PINECONE_ENVIRONMENT: 'test-env',
                PINECONE_INDEX: 'clarity-bridge',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        {
          provide: LlmCoreService,
          useValue: {
            generateEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<PineconeProvider>(PineconeProvider);
    configService = module.get(ConfigService);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('pinecone');
    });

    it('should load configuration from ConfigService', () => {
      expect(configService.get).toHaveBeenCalledWith('PINECONE_API_KEY', '');
      expect(configService.get).toHaveBeenCalledWith('PINECONE_ENVIRONMENT', '');
      expect(configService.get).toHaveBeenCalledWith('PINECONE_INDEX', 'clarity-bridge');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with existing index', async () => {
      // Arrange
      mockPineconeClient.listIndexes.mockResolvedValue({
        indexes: [{ name: 'clarity-bridge' }],
      });

      // Act
      await provider.initialize();

      // Assert
      expect(Pinecone).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
      expect(mockPineconeClient.listIndexes).toHaveBeenCalled();
      expect(mockPineconeClient.createIndex).not.toHaveBeenCalled();
      expect(mockPineconeClient.index).toHaveBeenCalledWith('clarity-bridge');
    });

    it('should create new index if it does not exist', async () => {
      // Arrange
      mockPineconeClient.listIndexes.mockResolvedValue({
        indexes: [],
      });

      // Mock setTimeout to speed up test
      jest.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      // Act
      await provider.initialize();

      // Assert
      expect(mockPineconeClient.createIndex).toHaveBeenCalledWith({
        name: 'clarity-bridge',
        dimension: 1536,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
      expect(mockPineconeClient.index).toHaveBeenCalledWith('clarity-bridge');

      // Restore setTimeout
      jest.restoreAllMocks();
    });

    it('should skip initialization if no API key', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'PINECONE_API_KEY') return '';
        return 'test-value';
      });

      // Create new provider instance with no API key
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          PineconeProvider,
          { provide: ConfigService, useValue: configService },
          { provide: LlmCoreService, useValue: llmService },
        ],
      }).compile();

      const providerWithoutKey = moduleWithoutKey.get<PineconeProvider>(PineconeProvider);

      // Act
      await providerWithoutKey.initialize();

      // Assert
      expect(Pinecone).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const error = new Error('Pinecone connection failed');
      mockPineconeClient.listIndexes.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.initialize()).rejects.toThrow('Pinecone connection failed');
    });

    it('should not re-initialize if already initialized', async () => {
      // Arrange
      await provider.initialize(); // First initialization
      jest.clearAllMocks();

      // Act
      await provider.initialize(); // Second initialization

      // Assert
      expect(Pinecone).not.toHaveBeenCalled();
    });
  });

  describe('isAvailable', () => {
    it('should return true when Pinecone is available', async () => {
      // Arrange
      mockIndex.describeIndexStats.mockResolvedValue({ totalVectorCount: 100 });

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(true);
      expect(mockIndex.describeIndexStats).toHaveBeenCalled();
    });

    it('should return false when no API key', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'PINECONE_API_KEY') return '';
        return 'test-value';
      });

      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          PineconeProvider,
          { provide: ConfigService, useValue: configService },
          { provide: LlmCoreService, useValue: llmService },
        ],
      }).compile();

      const providerWithoutKey = moduleWithoutKey.get<PineconeProvider>(PineconeProvider);

      // Act
      const result = await providerWithoutKey.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when Pinecone connection fails', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockIndex.describeIndexStats.mockRejectedValue(error);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when stats return null', async () => {
      // Arrange
      mockIndex.describeIndexStats.mockResolvedValue(null);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('upsert', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should upsert documents with embeddings successfully', async () => {
      // Arrange
      const documents = [mockVectorDocument];

      // Act
      await provider.upsert(documents);

      // Assert
      expect(mockIndex.upsert).toHaveBeenCalledWith([
        {
          id: 'doc-123',
          values: mockEmbedding,
          metadata: mockVectorDocument.metadata,
        },
      ]);
    });

    it('should generate embeddings for documents without them', async () => {
      // Arrange
      const documentsWithoutEmbedding = [
        {
          ...mockVectorDocument,
          embedding: undefined,
        },
      ];

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { totalTokens: 10 },
      });

      // Act
      await provider.upsert(documentsWithoutEmbedding);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(mockVectorDocument.content);
      expect(mockIndex.upsert).toHaveBeenCalledWith([
        {
          id: 'doc-123',
          values: mockEmbedding,
          metadata: mockVectorDocument.metadata,
        },
      ]);
    });

    it('should handle large batches with chunking', async () => {
      // Arrange
      const documents = Array.from({ length: 250 }, (_, i) => ({
        ...mockVectorDocument,
        id: `doc-${i}`,
      }));

      // Act
      await provider.upsert(documents);

      // Assert
      expect(mockIndex.upsert).toHaveBeenCalledTimes(3); // 100 + 100 + 50
      expect(mockIndex.upsert).toHaveBeenNthCalledWith(1, expect.arrayContaining([
        expect.objectContaining({ id: 'doc-0' }),
      ]));
    });

    it('should handle upsert errors', async () => {
      // Arrange
      const error = new Error('Upsert failed');
      mockIndex.upsert.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.upsert([mockVectorDocument])).rejects.toThrow('Upsert failed');
    });

    it('should handle embedding generation errors', async () => {
      // Arrange
      const documentsWithoutEmbedding = [
        {
          ...mockVectorDocument,
          embedding: undefined,
        },
      ];

      const error = new Error('Embedding generation failed');
      llmService.generateEmbedding.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.upsert(documentsWithoutEmbedding)).rejects.toThrow(
        'Embedding generation failed'
      );
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should search vectors successfully', async () => {
      // Arrange
      const embedding = mockEmbedding;
      const options: VectorSearchOptions = {
        topK: 5,
        includeMetadata: true,
        filter: { type: 'specification' },
      };

      // Act
      const results = await provider.search(embedding, options);

      // Assert
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
        filter: { type: 'specification' },
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'doc-123',
        score: 0.95,
        metadata: mockVectorDocument.metadata,
      });
    });

    it('should use default options when not provided', async () => {
      // Act
      await provider.search(mockEmbedding);

      // Assert
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: mockEmbedding,
        topK: 10,
        includeMetadata: true,
        filter: undefined,
      });
    });

    it('should handle search errors', async () => {
      // Arrange
      const error = new Error('Search failed');
      mockIndex.query.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.search(mockEmbedding)).rejects.toThrow('Search failed');
    });

    it('should handle empty search results', async () => {
      // Arrange
      mockIndex.query.mockResolvedValue({ matches: [] });

      // Act
      const results = await provider.search(mockEmbedding);

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('searchByText', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should search by text successfully', async () => {
      // Arrange
      const text = 'test query';
      const options: VectorSearchOptions = { topK: 3 };

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding,
        usage: { totalTokens: 5 },
      });

      // Act
      const results = await provider.searchByText(text, options);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(text);
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: mockEmbedding,
        topK: 3,
        includeMetadata: true,
        filter: undefined,
      });
      expect(results).toHaveLength(2);
    });

    it('should handle text embedding errors', async () => {
      // Arrange
      const error = new Error('Embedding failed');
      llmService.generateEmbedding.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.searchByText('test')).rejects.toThrow('Embedding failed');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should delete vectors by IDs successfully', async () => {
      // Arrange
      const ids = ['doc-123', 'doc-456'];

      // Act
      await provider.delete(ids);

      // Assert
      expect(mockIndex.deleteMany).toHaveBeenCalledWith(ids);
    });

    it('should handle delete errors', async () => {
      // Arrange
      const error = new Error('Delete failed');
      mockIndex.deleteMany.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.delete(['doc-123'])).rejects.toThrow('Delete failed');
    });

    it('should handle empty ID array', async () => {
      // Act
      await provider.delete([]);

      // Assert
      expect(mockIndex.deleteMany).toHaveBeenCalledWith([]);
    });
  });

  describe('deleteByFilter', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should delete vectors by filter successfully', async () => {
      // Arrange
      const filter = { type: 'specification', userId: 'user-123' };

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      expect(mockIndex.deleteMany).toHaveBeenCalledWith({
        filter,
      });
    });

    it('should handle filter delete errors', async () => {
      // Arrange
      const error = new Error('Filter delete failed');
      mockIndex.deleteMany.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.deleteByFilter({ type: 'test' })).rejects.toThrow(
        'Filter delete failed'
      );
    });
  });

  describe('fetch', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should fetch vectors by IDs successfully', async () => {
      // Arrange
      const ids = ['doc-123'];

      // Act
      const results = await provider.fetch(ids);

      // Assert
      expect(mockIndex.fetch).toHaveBeenCalledWith(ids);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'doc-123',
        content: undefined, // Content not included in Pinecone fetch
        embedding: mockEmbedding,
        metadata: mockVectorDocument.metadata,
      });
    });

    it('should handle fetch errors', async () => {
      // Arrange
      const error = new Error('Fetch failed');
      mockIndex.fetch.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.fetch(['doc-123'])).rejects.toThrow('Fetch failed');
    });

    it('should handle empty fetch results', async () => {
      // Arrange
      mockIndex.fetch.mockResolvedValue({ vectors: {} });

      // Act
      const results = await provider.fetch(['nonexistent']);

      // Assert
      expect(results).toEqual([]);
    });

    it('should handle missing vectors in fetch response', async () => {
      // Arrange
      mockIndex.fetch.mockResolvedValue({
        vectors: {
          'doc-123': {
            id: 'doc-123',
            values: mockEmbedding,
            metadata: mockVectorDocument.metadata,
          },
        },
      });

      // Act
      const results = await provider.fetch(['doc-123', 'nonexistent']);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-123');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeouts', async () => {
      // Arrange
      const timeoutError = new Error('Network timeout');
      mockPineconeClient.listIndexes.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(provider.initialize()).rejects.toThrow('Network timeout');
    });

    it('should handle API rate limiting', async () => {
      // Arrange
      const rateLimitError = new Error('Rate limit exceeded');
      mockIndex.query.mockRejectedValue(rateLimitError);

      await provider.initialize();

      // Act & Assert
      await expect(provider.search(mockEmbedding)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle invalid API responses', async () => {
      // Arrange
      mockIndex.query.mockResolvedValue(null);

      await provider.initialize();

      // Act & Assert
      await expect(provider.search(mockEmbedding)).rejects.toThrow();
    });

    it('should handle concurrent operations', async () => {
      // Arrange
      await provider.initialize();

      // Act
      const promises = [
        provider.upsert([mockVectorDocument]),
        provider.search(mockEmbedding),
        provider.fetch(['doc-123']),
      ];

      // Assert
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Provider State Management', () => {
    it('should track initialization state correctly', async () => {
      // Initially not initialized
      expect((provider as any).initialized).toBe(false);

      // After initialization
      await provider.initialize();
      expect((provider as any).initialized).toBe(true);
    });

    it('should maintain client and index references', async () => {
      // Act
      await provider.initialize();

      // Assert
      expect((provider as any).client).toBeDefined();
      expect((provider as any).index).toBeDefined();
    });
  });
});
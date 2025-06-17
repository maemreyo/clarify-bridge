import { Test, TestingModule } from '@nestjs/testing';
import { MemoryVectorProvider } from './memory.provider';
import { LlmCoreService } from '@core/llm';
import {
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
} from '../interfaces/vector-provider.interface';

describe('MemoryVectorProvider', () => {
  let provider: MemoryVectorProvider;
  let llmService: jest.Mocked<LlmCoreService>;

  const mockEmbedding1 = Array.from({ length: 1536 }, () => Math.random());
  const mockEmbedding2 = Array.from({ length: 1536 }, () => Math.random());
  const mockEmbedding3 = Array.from({ length: 1536 }, () => Math.random());

  const mockVectorDocument1: VectorDocument = {
    id: 'doc-123',
    content: 'This is a test document about software specifications',
    embedding: mockEmbedding1,
    metadata: {
      id: 'doc-123',
      type: 'specification',
      userId: 'user-123',
      teamId: 'team-456',
      title: 'Software Specification',
      tags: ['software', 'spec'],
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
  };

  const mockVectorDocument2: VectorDocument = {
    id: 'doc-456',
    content: 'This document contains context about user requirements',
    embedding: mockEmbedding2,
    metadata: {
      id: 'doc-456',
      type: 'context',
      userId: 'user-789',
      teamId: 'team-456',
      title: 'User Requirements',
      tags: ['requirements', 'user'],
      createdAt: new Date('2024-01-14T10:00:00Z'),
    },
  };

  const mockVectorDocument3: VectorDocument = {
    id: 'doc-789',
    content: 'Knowledge base article about best practices',
    embedding: mockEmbedding3,
    metadata: {
      id: 'doc-789',
      type: 'knowledge',
      userId: 'user-123',
      teamId: 'team-999',
      title: 'Best Practices',
      tags: ['practices', 'guide'],
      createdAt: new Date('2024-01-16T10:00:00Z'),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryVectorProvider,
        {
          provide: LlmCoreService,
          useValue: {
            generateEmbedding: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<MemoryVectorProvider>(MemoryVectorProvider);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('Constructor and Basic Properties', () => {
    it('should be defined', () => {
      expect(provider).toBeDefined();
      expect(provider.name).toBe('memory');
    });

    it('should start with empty document storage', () => {
      expect((provider as any).documents.size).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Act
      await provider.initialize();

      // Assert - just verifies no errors thrown
      expect(provider).toBeDefined();
    });

    it('should be idempotent', async () => {
      // Act
      await provider.initialize();
      await provider.initialize();

      // Assert - no errors should be thrown
      expect(provider).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should always return true', async () => {
      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('upsert', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should upsert documents with existing embeddings', async () => {
      // Arrange
      const documents = [mockVectorDocument1, mockVectorDocument2];

      // Act
      await provider.upsert(documents);

      // Assert
      const storedDocs = (provider as any).documents;
      expect(storedDocs.size).toBe(2);
      expect(storedDocs.get('doc-123')).toEqual(mockVectorDocument1);
      expect(storedDocs.get('doc-456')).toEqual(mockVectorDocument2);
      expect(llmService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should generate embeddings for documents without them', async () => {
      // Arrange
      const documentWithoutEmbedding: VectorDocument = {
        ...mockVectorDocument1,
        embedding: undefined,
      };

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding1,
        usage: { totalTokens: 100 },
      });

      // Act
      await provider.upsert([documentWithoutEmbedding]);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(documentWithoutEmbedding.content);

      const storedDoc = (provider as any).documents.get('doc-123');
      expect(storedDoc.embedding).toEqual(mockEmbedding1);
    });

    it('should handle mixed documents (with and without embeddings)', async () => {
      // Arrange
      const docWithEmbedding = mockVectorDocument1;
      const docWithoutEmbedding: VectorDocument = {
        ...mockVectorDocument2,
        embedding: undefined,
      };

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding2,
        usage: { totalTokens: 80 },
      });

      // Act
      await provider.upsert([docWithEmbedding, docWithoutEmbedding]);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledTimes(1);
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(docWithoutEmbedding.content);

      const storedDocs = (provider as any).documents;
      expect(storedDocs.size).toBe(2);
      expect(storedDocs.get('doc-123').embedding).toEqual(mockEmbedding1);
      expect(storedDocs.get('doc-456').embedding).toEqual(mockEmbedding2);
    });

    it('should update existing documents', async () => {
      // Arrange
      await provider.upsert([mockVectorDocument1]);

      const updatedDocument: VectorDocument = {
        ...mockVectorDocument1,
        content: 'Updated content',
        metadata: {
          ...mockVectorDocument1.metadata,
          title: 'Updated Title',
        },
      };

      // Act
      await provider.upsert([updatedDocument]);

      // Assert
      const storedDocs = (provider as any).documents;
      expect(storedDocs.size).toBe(1);
      expect(storedDocs.get('doc-123').content).toBe('Updated content');
      expect(storedDocs.get('doc-123').metadata.title).toBe('Updated Title');
    });

    it('should handle embedding generation errors', async () => {
      // Arrange
      const documentWithoutEmbedding: VectorDocument = {
        ...mockVectorDocument1,
        embedding: undefined,
      };

      const error = new Error('Embedding generation failed');
      llmService.generateEmbedding.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.upsert([documentWithoutEmbedding])).rejects.toThrow(
        'Embedding generation failed'
      );
    });

    it('should handle empty document array', async () => {
      // Act
      await provider.upsert([]);

      // Assert
      expect((provider as any).documents.size).toBe(0);
      expect(llmService.generateEmbedding).not.toHaveBeenCalled();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await provider.initialize();
      await provider.upsert([mockVectorDocument1, mockVectorDocument2, mockVectorDocument3]);
    });

    it('should search vectors successfully and return sorted results', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1; // Should be most similar to doc-123
      const options: VectorSearchOptions = {
        topK: 2,
        includeMetadata: true,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('doc-123'); // Most similar
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[0].metadata).toEqual(mockVectorDocument1.metadata);
      expect(results[0].content).toBe(mockVectorDocument1.content);
    });

    it('should apply filters correctly', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1;
      const options: VectorSearchOptions = {
        topK: 10,
        filter: { type: 'context' },
        includeMetadata: true,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-456');
      expect(results[0].metadata?.type).toBe('context');
    });

    it('should apply multiple filters', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1;
      const options: VectorSearchOptions = {
        topK: 10,
        filter: {
          teamId: 'team-456',
          userId: 'user-123',
        },
        includeMetadata: true,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-123');
    });

    it('should apply array filters correctly', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1;
      const options: VectorSearchOptions = {
        topK: 10,
        filter: {
          type: ['specification', 'context'],
        },
        includeMetadata: true,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id)).toContain('doc-123');
      expect(results.map(r => r.id)).toContain('doc-456');
    });

    it('should apply minimum score filter', async () => {
      // Arrange
      const queryEmbedding = Array.from({ length: 1536 }, () => 0); // Low similarity
      const options: VectorSearchOptions = {
        topK: 10,
        minScore: 0.9, // High threshold
        includeMetadata: true,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(0); // No results should meet the high threshold
    });

    it('should use default options when not provided', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1;

      // Act
      const results = await provider.search(queryEmbedding);

      // Assert
      expect(results.length).toBeLessThanOrEqual(10); // Default topK
      expect(results[0].metadata).toBeDefined(); // Default includeMetadata
    });

    it('should handle includeMetadata option', async () => {
      // Arrange
      const queryEmbedding = mockEmbedding1;
      const options: VectorSearchOptions = {
        topK: 1,
        includeMetadata: false,
      };

      // Act
      const results = await provider.search(queryEmbedding, options);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].metadata).toBeUndefined();
    });

    it('should skip documents without embeddings', async () => {
      // Arrange
      const docWithoutEmbedding: VectorDocument = {
        id: 'doc-no-embedding',
        content: 'Document without embedding',
        metadata: {
          id: 'doc-no-embedding',
          type: 'knowledge',
          createdAt: new Date(),
        },
      };

      // Directly add to documents map to simulate the scenario
      (provider as any).documents.set('doc-no-embedding', docWithoutEmbedding);

      const queryEmbedding = mockEmbedding1;

      // Act
      const results = await provider.search(queryEmbedding);

      // Assert
      expect(results).toHaveLength(3); // Only the 3 documents with embeddings
      expect(results.map(r => r.id)).not.toContain('doc-no-embedding');
    });

    it('should calculate cosine similarity correctly', async () => {
      // Arrange - Create identical embeddings for perfect similarity
      const identicalEmbedding = [...mockEmbedding1];
      const docWithIdenticalEmbedding: VectorDocument = {
        id: 'doc-identical',
        content: 'Identical content',
        embedding: identicalEmbedding,
        metadata: {
          id: 'doc-identical',
          type: 'test',
          createdAt: new Date(),
        },
      };

      await provider.upsert([docWithIdenticalEmbedding]);

      // Act
      const results = await provider.search(mockEmbedding1, { topK: 1 });

      // Assert
      expect(results[0].score).toBeCloseTo(1.0, 5); // Perfect similarity
    });
  });

  describe('searchByText', () => {
    beforeEach(async () => {
      await provider.initialize();
      await provider.upsert([mockVectorDocument1, mockVectorDocument2]);
    });

    it('should search by text successfully', async () => {
      // Arrange
      const searchText = 'software specifications';
      const options: VectorSearchOptions = { topK: 1 };

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding1,
        usage: { totalTokens: 50 },
      });

      // Act
      const results = await provider.searchByText(searchText, options);

      // Assert
      expect(llmService.generateEmbedding).toHaveBeenCalledWith(searchText);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('doc-123');
    });

    it('should handle embedding generation errors in text search', async () => {
      // Arrange
      const error = new Error('Text embedding failed');
      llmService.generateEmbedding.mockRejectedValue(error);

      // Act & Assert
      await expect(provider.searchByText('test query')).rejects.toThrow('Text embedding failed');
    });

    it('should pass through search options correctly', async () => {
      // Arrange
      const searchText = 'requirements';
      const options: VectorSearchOptions = {
        topK: 5,
        filter: { type: 'context' },
        minScore: 0.1,
      };

      llmService.generateEmbedding.mockResolvedValue({
        embedding: mockEmbedding2,
        usage: { totalTokens: 30 },
      });

      // Act
      const results = await provider.searchByText(searchText, options);

      // Assert
      expect(results).toHaveLength(1);
      expect(results[0].metadata?.type).toBe('context');
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      await provider.initialize();
      await provider.upsert([mockVectorDocument1, mockVectorDocument2, mockVectorDocument3]);
    });

    it('should delete documents by IDs successfully', async () => {
      // Arrange
      const idsToDelete = ['doc-123', 'doc-456'];

      // Act
      await provider.delete(idsToDelete);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(1);
      expect(documents.has('doc-123')).toBe(false);
      expect(documents.has('doc-456')).toBe(false);
      expect(documents.has('doc-789')).toBe(true);
    });

    it('should handle deletion of non-existent IDs gracefully', async () => {
      // Arrange
      const idsToDelete = ['doc-123', 'non-existent', 'doc-456'];

      // Act
      await provider.delete(idsToDelete);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(1);
      expect(documents.has('doc-789')).toBe(true);
    });

    it('should handle empty ID array', async () => {
      // Act
      await provider.delete([]);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(3); // No documents should be deleted
    });

    it('should delete all documents when all IDs provided', async () => {
      // Arrange
      const allIds = ['doc-123', 'doc-456', 'doc-789'];

      // Act
      await provider.delete(allIds);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(0);
    });
  });

  describe('deleteByFilter', () => {
    beforeEach(async () => {
      await provider.initialize();
      await provider.upsert([mockVectorDocument1, mockVectorDocument2, mockVectorDocument3]);
    });

    it('should delete documents by filter successfully', async () => {
      // Arrange
      const filter = { teamId: 'team-456' };

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(1);
      expect(documents.has('doc-789')).toBe(true); // This one has different teamId
      expect(documents.has('doc-123')).toBe(false);
      expect(documents.has('doc-456')).toBe(false);
    });

    it('should delete documents by multiple filters', async () => {
      // Arrange
      const filter = {
        teamId: 'team-456',
        type: 'specification',
      };

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(2);
      expect(documents.has('doc-123')).toBe(false); // Matches both filters
      expect(documents.has('doc-456')).toBe(true);  // Different type
      expect(documents.has('doc-789')).toBe(true);  // Different teamId
    });

    it('should handle array filters in deletion', async () => {
      // Arrange
      const filter = { type: ['specification', 'context'] };

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(1);
      expect(documents.has('doc-789')).toBe(true); // type: 'knowledge'
    });

    it('should handle filters that match no documents', async () => {
      // Arrange
      const filter = { type: 'non-existent-type' };

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(3); // No documents should be deleted
    });

    it('should handle empty filter object', async () => {
      // Arrange
      const filter = {};

      // Act
      await provider.deleteByFilter(filter);

      // Assert
      const documents = (provider as any).documents;
      expect(documents.size).toBe(0); // Empty filter matches all documents
    });
  });

  describe('fetch', () => {
    beforeEach(async () => {
      await provider.initialize();
      await provider.upsert([mockVectorDocument1, mockVectorDocument2, mockVectorDocument3]);
    });

    it('should fetch documents by IDs successfully', async () => {
      // Arrange
      const idsToFetch = ['doc-123', 'doc-456'];

      // Act
      const results = await provider.fetch(idsToFetch);

      // Assert
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockVectorDocument1);
      expect(results[1]).toEqual(mockVectorDocument2);
    });

    it('should handle non-existent IDs gracefully', async () => {
      // Arrange
      const idsToFetch = ['doc-123', 'non-existent', 'doc-456'];

      // Act
      const results = await provider.fetch(idsToFetch);

      // Assert
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id)).toContain('doc-123');
      expect(results.map(r => r.id)).toContain('doc-456');
      expect(results.map(r => r.id)).not.toContain('non-existent');
    });

    it('should handle empty ID array', async () => {
      // Act
      const results = await provider.fetch([]);

      // Assert
      expect(results).toEqual([]);
    });

    it('should return documents in the same order as requested IDs', async () => {
      // Arrange
      const idsToFetch = ['doc-456', 'doc-123', 'doc-789'];

      // Act
      const results = await provider.fetch(idsToFetch);

      // Assert
      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('doc-456');
      expect(results[1].id).toBe('doc-123');
      expect(results[2].id).toBe('doc-789');
    });

    it('should handle all non-existent IDs', async () => {
      // Arrange
      const idsToFetch = ['non-existent-1', 'non-existent-2'];

      // Act
      const results = await provider.fetch(idsToFetch);

      // Assert
      expect(results).toEqual([]);
    });
  });

  describe('Cosine Similarity Calculation', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should calculate perfect similarity correctly', () => {
      // Arrange
      const vector = [1, 0, 0, 0];
      const identicalVector = [1, 0, 0, 0];

      // Access private method for testing
      const similarity = (provider as any).cosineSimilarity(vector, identicalVector);

      // Assert
      expect(similarity).toBeCloseTo(1.0, 10);
    });

    it('should calculate zero similarity correctly', () => {
      // Arrange
      const vector1 = [1, 0, 0, 0];
      const vector2 = [0, 1, 0, 0];

      // Access private method for testing
      const similarity = (provider as any).cosineSimilarity(vector1, vector2);

      // Assert
      expect(similarity).toBeCloseTo(0.0, 10);
    });

    it('should handle negative similarity', () => {
      // Arrange
      const vector1 = [1, 0, 0, 0];
      const vector2 = [-1, 0, 0, 0];

      // Access private method for testing
      const similarity = (provider as any).cosineSimilarity(vector1, vector2);

      // Assert
      expect(similarity).toBeCloseTo(-1.0, 10);
    });

    it('should handle zero vectors gracefully', () => {
      // Arrange
      const vector1 = [0, 0, 0, 0];
      const vector2 = [1, 0, 0, 0];

      // Access private method for testing
      const similarity = (provider as any).cosineSimilarity(vector1, vector2);

      // Assert
      expect(similarity).toBeNaN(); // Mathematical expectation for zero vector
    });
  });

  describe('Filter Matching', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should match simple filters correctly', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = { type: 'specification' };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(true);
    });

    it('should not match incorrect filters', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = { type: 'wrong-type' };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(false);
    });

    it('should match array filters correctly', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = { type: ['specification', 'context'] };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(true);
    });

    it('should not match when value not in array filter', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = { type: ['context', 'knowledge'] };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(false);
    });

    it('should match multiple filters correctly', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = {
        type: 'specification',
        userId: 'user-123',
        teamId: 'team-456',
      };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(true);
    });

    it('should fail when any filter does not match', () => {
      // Arrange
      const doc = mockVectorDocument1;
      const filter = {
        type: 'specification',
        userId: 'wrong-user',
        teamId: 'team-456',
      };

      // Access private method for testing
      const matches = (provider as any).matchesFilter(doc, filter);

      // Assert
      expect(matches).toBe(false);
    });
  });

  describe('Memory Management and Performance', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should handle large number of documents efficiently', async () => {
      // Arrange
      const largeNumberOfDocs = Array.from({ length: 1000 }, (_, i) => ({
        id: `doc-${i}`,
        content: `Content for document ${i}`,
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        metadata: {
          id: `doc-${i}`,
          type: 'test' as const,
          createdAt: new Date(),
        },
      }));

      // Act
      const startTime = Date.now();
      await provider.upsert(largeNumberOfDocs);
      const upsertTime = Date.now() - startTime;

      const searchStartTime = Date.now();
      await provider.search(mockEmbedding1, { topK: 10 });
      const searchTime = Date.now() - searchStartTime;

      // Assert
      expect(upsertTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(searchTime).toBeLessThan(1000); // Should complete within 1 second
      expect((provider as any).documents.size).toBe(1000);
    });

    it('should maintain performance with frequent operations', async () => {
      // Arrange
      const testDocs = [mockVectorDocument1, mockVectorDocument2, mockVectorDocument3];
      await provider.upsert(testDocs);

      // Act & Assert - Multiple rapid operations
      for (let i = 0; i < 100; i++) {
        await provider.search(mockEmbedding1, { topK: 1 });
        await provider.fetch(['doc-123']);

        if (i % 10 === 0) {
          await provider.delete([`doc-${i}`]);
        }
      }

      // Should complete without errors
      expect((provider as any).documents.size).toBeGreaterThan(0);
    });
  });
});
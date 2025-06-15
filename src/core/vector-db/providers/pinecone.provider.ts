//  Pinecone vector database provider

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { LlmCoreService } from '@core/llm';
import {
  VectorProvider,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetadata,
} from '../interfaces/vector-provider.interface';

@Injectable()
export class PineconeProvider implements VectorProvider {
  readonly name = 'pinecone';
  private readonly logger = new Logger(PineconeProvider.name);
  private client: Pinecone;
  private index: any;
  private apiKey: string;
  private environment: string;
  private indexName: string;
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private llmService: LlmCoreService,
  ) {
    this.apiKey = this.configService.get<string>('PINECONE_API_KEY', '');
    this.environment = this.configService.get<string>('PINECONE_ENVIRONMENT', '');
    this.indexName = this.configService.get<string>('PINECONE_INDEX', 'clarity-bridge');
  }

  async initialize(): Promise<void> {
    if (this.initialized || !this.apiKey) {
      return;
    }

    try {
      this.client = new Pinecone({
        apiKey: this.apiKey,
      });

      // Get or create index
      const indexes = await this.client.listIndexes();
      const indexExists = indexes.indexes?.some(idx => idx.name === this.indexName);

      if (!indexExists) {
        this.logger.log(`Creating Pinecone index: ${this.indexName}`);
        await this.client.createIndex({
          name: this.indexName,
          dimension: 1536, // OpenAI embedding dimension
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });

        // Wait for index to be ready
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      this.index = this.client.index(this.indexName);
      this.initialized = true;
      this.logger.log('Pinecone provider initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Pinecone', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.initialize();
      const stats = await this.index.describeIndexStats();
      return stats !== null;
    } catch (error) {
      this.logger.warn('Pinecone not available', error);
      return false;
    }
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    try {
      // Generate embeddings for documents without them
      const documentsToEmbed = documents.filter(doc => !doc.embedding);
      if (documentsToEmbed.length > 0) {
        const embeddings = await this.llmService.generateEmbeddings(
          documentsToEmbed.map(doc => doc.content),
        );

        documentsToEmbed.forEach((doc, index) => {
          doc.embedding = embeddings[index].embedding;
        });
      }

      // Prepare vectors for Pinecone
      const vectors = documents.map(doc => ({
        id: doc.id,
        values: doc.embedding!,
        metadata: {
          ...doc.metadata,
          content: doc.content.substring(0, 1000), // Store truncated content
          createdAt: doc.metadata.createdAt.toISOString(),
        },
      }));

      // Batch upsert (Pinecone recommends batches of 100)
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await this.index.upsert(batch);
      }

      this.logger.log(`Upserted ${documents.length} vectors to Pinecone`);
    } catch (error) {
      this.logger.error('Failed to upsert vectors', error);
      throw error;
    }
  }

  async search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    await this.ensureInitialized();

    try {
      const queryOptions: any = {
        vector: embedding,
        topK: options?.topK || 10,
        includeMetadata: options?.includeMetadata !== false,
        includeValues: options?.includeValues || false,
      };

      if (options?.filter) {
        queryOptions.filter = this.buildPineconeFilter(options.filter);
      }

      const response = await this.index.query(queryOptions);

      return response.matches
        .filter(match => !options?.minScore || match.score >= options.minScore)
        .map(match => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata as VectorMetadata,
          content: match.metadata?.content,
        }));
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  async searchByText(text: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    try {
      // Generate embedding for search text
      const embeddingResult = await this.llmService.generateEmbedding(text);
      return this.search(embeddingResult.embedding, options);
    } catch (error) {
      this.logger.error('Text search failed', error);
      throw error;
    }
  }

  async delete(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.index.deleteMany(ids);
      this.logger.log(`Deleted ${ids.length} vectors from Pinecone`);
    } catch (error) {
      this.logger.error('Delete failed', error);
      throw error;
    }
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    await this.ensureInitialized();

    try {
      await this.index.deleteMany({
        filter: this.buildPineconeFilter(filter),
      });
      this.logger.log('Deleted vectors by filter');
    } catch (error) {
      this.logger.error('Delete by filter failed', error);
      throw error;
    }
  }

  async fetch(ids: string[]): Promise<VectorDocument[]> {
    await this.ensureInitialized();

    try {
      const response = await this.index.fetch(ids);

      return Object.entries(response.records).map(([id, record]) => ({
        id,
        content: record.metadata?.content || '',
        embedding: record.values,
        metadata: record.metadata as VectorMetadata,
      }));
    } catch (error) {
      this.logger.error('Fetch failed', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private buildPineconeFilter(filter: Record<string, any>): Record<string, any> {
    // Convert our filter format to Pinecone filter format
    const pineconeFilter: Record<string, any> = {};

    Object.entries(filter).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        pineconeFilter[key] = { $in: value };
      } else if (typeof value === 'object' && value !== null) {
        // Handle range queries
        if ('$gte' in value || '$lte' in value || '$gt' in value || '$lt' in value) {
          pineconeFilter[key] = value;
        } else {
          pineconeFilter[key] = { $eq: value };
        }
      } else {
        pineconeFilter[key] = { $eq: value };
      }
    });

    return pineconeFilter;
  }
}

// ============================================

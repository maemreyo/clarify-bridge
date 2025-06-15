//  Main vector database service

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database';
import { PineconeProvider } from './providers/pinecone.provider';
import { MemoryVectorProvider } from './providers/memory.provider';
import {
  VectorProvider,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
  VectorMetadata,
} from './interfaces/vector-provider.interface';

export interface KnowledgeDocument {
  title: string;
  content: string;
  type: 'specification' | 'context' | 'knowledge' | 'template';
  userId?: string;
  teamId?: string;
  specificationId?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

@Injectable()
export class VectorDbService implements OnModuleInit {
  private readonly logger = new Logger(VectorDbService.name);
  private provider: VectorProvider;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private pineconeProvider: PineconeProvider,
    private memoryProvider: MemoryVectorProvider,
  ) {}

  async onModuleInit() {
    // Select provider based on configuration
    const providerName = this.configService.get<string>('VECTOR_DB_PROVIDER', 'memory');

    switch (providerName) {
      case 'pinecone':
        if (await this.pineconeProvider.isAvailable()) {
          this.provider = this.pineconeProvider;
        } else {
          this.logger.warn('Pinecone not available, falling back to memory provider');
          this.provider = this.memoryProvider;
        }
        break;
      default:
        this.provider = this.memoryProvider;
    }

    await this.provider.initialize();
    this.logger.log(`Using vector provider: ${this.provider.name}`);
  }

  /**
   * Store a knowledge document
   */
  async storeDocument(document: KnowledgeDocument): Promise<string> {
    const id = this.generateDocumentId(document);

    const vectorDoc: VectorDocument = {
      id,
      content: document.content,
      metadata: {
        id,
        type: document.type,
        userId: document.userId,
        teamId: document.teamId,
        specificationId: document.specificationId,
        title: document.title,
        tags: document.tags,
        createdAt: new Date(),
        ...document.metadata,
      },
    };

    await this.provider.upsert([vectorDoc]);

    // Log usage
    if (document.userId || document.teamId) {
      await this.prisma.usageLog.create({
        data: {
          userId: document.userId,
          teamId: document.teamId,
          action: 'vector_stored',
          metadata: { documentId: id, type: document.type },
        },
      });
    }

    return id;
  }

  /**
   * Store multiple documents
   */
  async storeDocuments(documents: KnowledgeDocument[]): Promise<string[]> {
    const vectorDocs: VectorDocument[] = documents.map(doc => ({
      id: this.generateDocumentId(doc),
      content: doc.content,
      metadata: {
        id: this.generateDocumentId(doc),
        type: doc.type,
        userId: doc.userId,
        teamId: doc.teamId,
        specificationId: doc.specificationId,
        title: doc.title,
        tags: doc.tags,
        createdAt: new Date(),
        ...doc.metadata,
      },
    }));

    await this.provider.upsert(vectorDocs);

    return vectorDocs.map(doc => doc.id);
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(
    query: string,
    options?: VectorSearchOptions & {
      userId?: string;
      teamId?: string;
      type?: string | string[];
    },
  ): Promise<VectorSearchResult[]> {
    // Build filter
    const filter: Record<string, any> = {};

    if (options?.userId) {
      filter.userId = options.userId;
    }

    if (options?.teamId) {
      filter.teamId = options.teamId;
    }

    if (options?.type) {
      filter.type = options.type;
    }

    const searchOptions: VectorSearchOptions = {
      ...options,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    };

    const results = await this.provider.searchByText(query, searchOptions);

    // Log usage
    if (options?.userId || options?.teamId) {
      await this.prisma.usageLog.create({
        data: {
          userId: options.userId,
          teamId: options.teamId,
          action: 'vector_search',
          metadata: { query, resultsCount: results.length },
        },
      });
    }

    return results;
  }

  /**
   * Get related specifications
   */
  async getRelatedSpecifications(
    specificationId: string,
    options?: {
      limit?: number;
      teamId?: string;
    },
  ): Promise<Array<{ id: string; title: string; score: number }>> {
    // Get the specification content
    const spec = await this.prisma.specification.findUnique({
      where: { id: specificationId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!spec || spec.versions.length === 0) {
      return [];
    }

    // Create search query from title and description
    const searchQuery = `${spec.title} ${spec.description || ''}`;

    // Search for similar specifications
    const results = await this.searchSimilar(searchQuery, {
      type: 'specification',
      teamId: options?.teamId,
      topK: options?.limit || 5,
      filter: {
        specificationId: { $ne: specificationId }, // Exclude current spec
      },
    });

    return results.map(result => ({
      id: result.metadata?.specificationId || result.id,
      title: result.metadata?.title || 'Unknown',
      score: result.score,
    }));
  }

  /**
   * Store specification for future reference
   */
  async indexSpecification(specificationId: string): Promise<void> {
    const spec = await this.prisma.specification.findUnique({
      where: { id: specificationId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!spec || spec.versions.length === 0) {
      throw new Error('Specification not found');
    }

    const version = spec.versions[0];
    const content = this.extractSpecificationContent(version);

    await this.storeDocument({
      title: spec.title,
      content,
      type: 'specification',
      userId: spec.authorId,
      teamId: spec.teamId || undefined,
      specificationId: spec.id,
      tags: [spec.priority.toLowerCase(), spec.status.toLowerCase()],
      metadata: {
        version: version.version,
        qualityScore: spec.qualityScore,
      },
    });

    this.logger.log(`Indexed specification: ${spec.title}`);
  }

  /**
   * Delete specification from index
   */
  async removeSpecification(specificationId: string): Promise<void> {
    await this.provider.deleteByFilter({ specificationId });
    this.logger.log(`Removed specification from index: ${specificationId}`);
  }

  /**
   * Store team knowledge base
   */
  async storeTeamKnowledge(
    teamId: string,
    title: string,
    content: string,
    tags?: string[],
  ): Promise<string> {
    return this.storeDocument({
      title,
      content,
      type: 'knowledge',
      teamId,
      tags,
    });
  }

  /**
   * Search team knowledge base
   */
  async searchTeamKnowledge(
    teamId: string,
    query: string,
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    return this.searchSimilar(query, {
      ...options,
      teamId,
      type: 'knowledge',
    });
  }

  /**
   * Clean up old vectors
   */
  async cleanup(olderThan: Date): Promise<void> {
    // This would need to be implemented based on provider capabilities
    this.logger.log('Vector cleanup not implemented for current provider');
  }

  private generateDocumentId(document: KnowledgeDocument): string {
    const prefix = document.type.substring(0, 3);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    return `${prefix}_${timestamp}_${random}`;
  }

  private extractSpecificationContent(version: any): string {
    const parts: string[] = [];

    // Extract content from all views
    if (version.pmView) {
      parts.push(JSON.stringify(version.pmView));
    }
    if (version.frontendView) {
      parts.push(JSON.stringify(version.frontendView));
    }
    if (version.backendView) {
      parts.push(JSON.stringify(version.backendView));
    }

    return parts.join('\n\n');
  }
}

// ============================================

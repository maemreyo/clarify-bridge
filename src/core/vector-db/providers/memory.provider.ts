//  In-memory vector provider for development/testing

import { Injectable, Logger } from '@nestjs/common';
import { LlmCoreService } from '@core/llm';
import {
  VectorProvider,
  VectorDocument,
  VectorSearchOptions,
  VectorSearchResult,
} from '../interfaces/vector-provider.interface';

@Injectable()
export class MemoryVectorProvider implements VectorProvider {
  readonly name = 'memory';
  private readonly logger = new Logger(MemoryVectorProvider.name);
  private documents: Map<string, VectorDocument> = new Map();

  constructor(private llmService: LlmCoreService) {}

  async initialize(): Promise<void> {
    this.logger.log('Memory vector provider initialized');
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async upsert(documents: VectorDocument[]): Promise<void> {
    // Generate embeddings for documents without them
    for (const doc of documents) {
      if (!doc.embedding) {
        const result = await this.llmService.generateEmbedding(doc.content);
        doc.embedding = result.embedding;
      }
      this.documents.set(doc.id, doc);
    }

    this.logger.log(`Upserted ${documents.length} vectors to memory`);
  }

  async search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];

    // Calculate cosine similarity for all documents
    for (const [id, doc] of this.documents.entries()) {
      if (!doc.embedding) continue;

      // Apply filters
      if (options?.filter && !this.matchesFilter(doc, options.filter)) {
        continue;
      }

      const score = this.cosineSimilarity(embedding, doc.embedding);

      if (!options?.minScore || score >= options.minScore) {
        results.push({
          id,
          score,
          metadata: options?.includeMetadata !== false ? doc.metadata : undefined,
          content: doc.content,
        });
      }
    }

    // Sort by score and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options?.topK || 10);
  }

  async searchByText(text: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const result = await this.llmService.generateEmbedding(text);
    return this.search(result.embedding, options);
  }

  async delete(ids: string[]): Promise<void> {
    ids.forEach(id => this.documents.delete(id));
    this.logger.log(`Deleted ${ids.length} vectors from memory`);
  }

  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    const toDelete: string[] = [];

    for (const [id, doc] of this.documents.entries()) {
      if (this.matchesFilter(doc, filter)) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => this.documents.delete(id));
    this.logger.log(`Deleted ${toDelete.length} vectors by filter`);
  }

  async fetch(ids: string[]): Promise<VectorDocument[]> {
    return ids
      .map(id => this.documents.get(id))
      .filter(doc => doc !== undefined) as VectorDocument[];
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private matchesFilter(doc: VectorDocument, filter: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filter)) {
      const docValue = doc.metadata[key];

      if (Array.isArray(value)) {
        if (!value.includes(docValue)) return false;
      } else if (docValue !== value) {
        return false;
      }
    }

    return true;
  }
}

// ============================================

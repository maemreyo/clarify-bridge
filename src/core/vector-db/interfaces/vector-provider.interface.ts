//  Vector database provider interface

export interface VectorMetadata {
  id: string;
  type: 'specification' | 'context' | 'knowledge' | 'template';
  userId?: string;
  teamId?: string;
  specificationId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  [key: string]: any;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata: VectorMetadata;
}

export interface VectorSearchOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeValues?: boolean;
  minScore?: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: VectorMetadata;
  content?: string;
}

export interface VectorProvider {
  readonly name: string;

  /**
   * Initialize the vector database (create index if needed)
   */
  initialize(): Promise<void>;

  /**
   * Upsert vectors into the database
   */
  upsert(documents: VectorDocument[]): Promise<void>;

  /**
   * Search for similar vectors
   */
  search(embedding: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>;

  /**
   * Search by text (will generate embedding internally)
   */
  searchByText(text: string, options?: VectorSearchOptions): Promise<VectorSearchResult[]>;

  /**
   * Delete vectors by ID
   */
  delete(ids: string[]): Promise<void>;

  /**
   * Delete vectors by filter
   */
  deleteByFilter(filter: Record<string, any>): Promise<void>;

  /**
   * Get vector by ID
   */
  fetch(ids: string[]): Promise<VectorDocument[]>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
}

// ============================================

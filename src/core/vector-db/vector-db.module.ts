// Updated: Vector database module configuration

import { Module, Global } from '@nestjs/common';
import { VectorDbService } from './vector-db.service';
import { PineconeProvider } from './providers/pinecone.provider';
import { MemoryVectorProvider } from './providers/memory.provider';

/**
 * Global vector database module for semantic search and memory
 */
@Global()
@Module({
  providers: [
    VectorDbService,
    PineconeProvider,
    MemoryVectorProvider,
  ],
  exports: [VectorDbService],
})
export class VectorDbModule {}

// ============================================
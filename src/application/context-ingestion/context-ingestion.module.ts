// Updated: Context ingestion module configuration

import { Module } from '@nestjs/common';
import { ContextIngestionService } from './context-ingestion.service';
import { TextProcessor } from './processors/text-processor';
import { ImageProcessor } from './processors/image-processor';

@Module({
  providers: [
    ContextIngestionService,
    TextProcessor,
    ImageProcessor,
  ],
  exports: [ContextIngestionService],
})
export class ContextIngestionModule {}

// ============================================
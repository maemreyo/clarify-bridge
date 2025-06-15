//  Multi-view generation module configuration

import { Module } from '@nestjs/common';
import { MultiViewGenerationService } from './multi-view-generation.service';
import { PmViewGenerator } from './generators/pm-view.generator';
import { FrontendViewGenerator } from './generators/frontend-view.generator';
import { BackendViewGenerator } from './generators/backend-view.generator';

@Module({
  providers: [
    MultiViewGenerationService,
    PmViewGenerator,
    FrontendViewGenerator,
    BackendViewGenerator,
  ],
  exports: [MultiViewGenerationService],
})
export class MultiViewGenerationModule {}

// ============================================

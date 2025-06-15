// Updated: Usage tracking module configuration

import { Module, Global } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';
import { UsageGuard } from './guards/usage.guard';

/**
 * Global usage tracking and quota management module
 */
@Global()
@Module({
  controllers: [UsageController],
  providers: [UsageService, UsageGuard],
  exports: [UsageService, UsageGuard],
})
export class UsageModule {}

// ============================================
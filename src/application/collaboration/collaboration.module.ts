//  Collaboration module configuration

import { Module } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { CollaborationController, UserReviewController } from './collaboration.controller';

@Module({
  controllers: [CollaborationController, UserReviewController],
  providers: [CollaborationService],
  exports: [CollaborationService],
})
export class CollaborationModule {}

// ============================================

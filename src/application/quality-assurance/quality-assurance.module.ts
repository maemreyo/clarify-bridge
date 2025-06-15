//  Quality assurance module configuration

import { Module } from '@nestjs/common';
import { QualityAssuranceService } from './quality-assurance.service';
import { PmViewValidator } from './validators/pm-view.validator';
import { FrontendViewValidator } from './validators/frontend-view.validator';
import { BackendViewValidator } from './validators/backend-view.validator';
import { CrossViewValidator } from './validators/cross-view.validator';

@Module({
  providers: [
    QualityAssuranceService,
    PmViewValidator,
    FrontendViewValidator,
    BackendViewValidator,
    CrossViewValidator,
  ],
  exports: [QualityAssuranceService],
})
export class QualityAssuranceModule {}

// ============================================

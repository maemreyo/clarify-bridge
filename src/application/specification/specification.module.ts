//  Specification module configuration

import { Module, forwardRef } from '@nestjs/common';
import { SpecificationService } from './specification.service';
import { SpecificationController } from './specification.controller';

@Module({
  controllers: [SpecificationController],
  providers: [
    SpecificationService,
    // Provide service name for job processor injection
    {
      provide: 'SpecificationService',
      useExisting: SpecificationService,
    },
  ],
  exports: [SpecificationService],
})
export class SpecificationModule {}

// ============================================

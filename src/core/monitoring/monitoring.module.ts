//  Monitoring module configuration

import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { MonitoringService } from './monitoring.service';
import { winstonLogger } from './logger/winston.logger';

/**
 * Global monitoring module for logging and metrics
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      instance: winstonLogger,
    }),
  ],
  providers: [MonitoringService],
  exports: [MonitoringService, WinstonModule],
})
export class MonitoringModule {}

// ============================================

// Updated: Job Queue module configuration

import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JobQueueService, QueueName } from './job-queue.service';
import { SpecificationProcessor } from './processors/specification.processor';

/**
 * Global Job Queue module for async processing
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QueueName.SPECIFICATION },
      { name: QueueName.NOTIFICATION },
      { name: QueueName.ANALYTICS },
    ),
  ],
  providers: [JobQueueService, SpecificationProcessor],
  exports: [JobQueueService, BullModule],
})
export class JobQueueModule {}

// ============================================
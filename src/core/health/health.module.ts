// Updated: Health module configuration

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { LlmHealthIndicator } from './indicators/llm.health';
import { VectorDbHealthIndicator } from './indicators/vector-db.health';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
  ],
  controllers: [HealthController],
  providers: [
    DatabaseHealthIndicator,
    RedisHealthIndicator,
    LlmHealthIndicator,
    VectorDbHealthIndicator,
  ],
})
export class HealthModule {}

// ============================================
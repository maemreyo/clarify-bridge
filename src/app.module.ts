//  Root application module - The Clarity Bridge

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Core Services Layer
import { DatabaseModule } from '@core/database';
import { AuthModule } from '@core/auth';
import { LlmCoreModule } from '@core/llm';
import { JobQueueModule } from '@core/queue';
import { TeamModule } from '@core/team';
import { NotificationModule } from '@core/notification';
import { VectorDbModule } from '@core/vector-db';
import { UsageModule } from '@core/usage';
import { PaymentModule } from '@core/payment';
import { HealthModule } from '@core/health';
import { MonitoringModule } from '@core/monitoring';

// Application Layer
import { SpecificationModule } from '@application/specification';
import { ContextIngestionModule } from '@application/context-ingestion';
import { MultiViewGenerationModule } from '@application/multi-view-generation';
import { DiagramGenerationModule } from '@application/diagram-generation';
import { QualityAssuranceModule } from '@application/quality-assurance';
import { CollaborationModule } from '@application/collaboration';
import { IntegrationModule } from '@application/integration';

// Gateway Layer
import { ApiGatewayModule } from '@gateway/api-gateway';
import { WebSocketModule } from '@gateway/websocket';
import { WebhookModule } from '@gateway/webhook';

// Configuration
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
      expandVariables: true,
    }),

    // Event system for async communication
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Core Services Layer (Foundation)
    DatabaseModule,
    AuthModule,
    LlmCoreModule,
    JobQueueModule,
    TeamModule,
    NotificationModule,
    VectorDbModule,
    UsageModule,
    PaymentModule,
    HealthModule,
    MonitoringModule,

    // Application Layer (Business Logic)
    SpecificationModule,
    ContextIngestionModule,
    MultiViewGenerationModule,
    DiagramGenerationModule,
    QualityAssuranceModule,
    CollaborationModule,
    IntegrationModule,

    // Gateway Layer (Entry Points)
    ApiGatewayModule,
    WebSocketModule,
    WebhookModule,
  ],
})
export class AppModule {}

// ============================================

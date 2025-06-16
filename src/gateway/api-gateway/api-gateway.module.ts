//  API Gateway module - Central entry point for all HTTP APIs

import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import all controllers from other modules
import { AuthController } from '@core/auth';
import { TeamController } from '@core/team';
import { NotificationController } from '@core/notification';
import { PaymentController, StripeWebhookController } from '@core/payment';
import { UsageController } from '@core/usage';
import { HealthController } from '@core/health';
import {
  SpecificationController,
  SpecificationVersionController,
} from '@application/specification';
import { CollaborationController, UserReviewController } from '@application/collaboration';
import { IntegrationController } from '@application/integration';

// Middleware
import { LoggingMiddleware } from './middleware/logging.middleware';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { CompressionMiddleware } from './middleware/compression.middleware';

@Module({
  imports: [
    // Rate limiting configuration

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get('RATE_LIMIT_TTL', 60) * 1000, // Convert to milliseconds
            limit: config.get('RATE_LIMIT_MAX', 100),
          },
        ],
        ignoreUserAgents: [/googlebot/gi, /bingbot/gi],
      }),
    }),
  ],
  controllers: [
    // Core controllers
    AuthController,
    TeamController,
    NotificationController,
    PaymentController,
    StripeWebhookController,
    UsageController,
    HealthController,

    // Application controllers
    SpecificationController,
    SpecificationVersionController,
    CollaborationController,
    UserReviewController,
    IntegrationController,
  ],
  providers: [
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class ApiGatewayModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply global middleware
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware, CompressionMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Exclude compression for webhooks (they need raw body)
    consumer
      .apply(CorrelationIdMiddleware, LoggingMiddleware)
      .exclude(
        { path: 'webhooks/stripe', method: RequestMethod.POST },
        { path: 'integrations/webhooks', method: RequestMethod.POST },
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

// ============================================

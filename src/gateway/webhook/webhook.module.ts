//  Webhook module for handling external service webhooks

import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [WebhookController],
})
export class WebhookModule {}

// ============================================

//  Notification module configuration

import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailProvider } from './providers/email.provider';
import { SlackProvider } from './providers/slack.provider';

/**
 * Global notification module for multi-channel notifications
 */
@Global()
@Module({
  providers: [NotificationService, EmailProvider, SlackProvider],
  exports: [NotificationService],
})
export class NotificationModule {}

// ============================================

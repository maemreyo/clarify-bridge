//  Notification provider interface

export interface NotificationOptions {
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
  scheduledAt?: Date;
}

export interface EmailOptions extends NotificationOptions {
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export interface NotificationProvider {
  readonly name: string;

  sendEmail(
    to: string | string[],
    subject: string,
    content: {
      text?: string;
      html?: string;
    },
    options?: EmailOptions,
  ): Promise<NotificationResult>;

  isAvailable(): Promise<boolean>;
}

// ============================================

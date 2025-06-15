//  Email provider implementation (using nodemailer)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  NotificationProvider,
  EmailOptions,
  NotificationResult,
} from '../interfaces/notification-provider.interface';

@Injectable()
export class EmailProvider implements NotificationProvider {
  readonly name = 'email';
  private readonly logger = new Logger(EmailProvider.name);
  private transporter: Transporter;
  private isConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    };

    if (!emailConfig.host || !emailConfig.auth.user || !emailConfig.auth.pass) {
      this.logger.warn('Email provider not configured - missing SMTP credentials');
      this.isConfigured = false;
      return;
    }

    this.transporter = nodemailer.createTransport(emailConfig);
    this.isConfigured = true;
    this.logger.log('Email provider initialized');
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('Email provider verification failed', error);
      return false;
    }
  }

  async sendEmail(
    to: string | string[],
    subject: string,
    content: { text?: string; html?: string },
    options?: EmailOptions,
  ): Promise<NotificationResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Email provider not configured',
        provider: this.name,
      };
    }

    try {
      const recipients = Array.isArray(to) ? to.join(', ') : to;

      const mailOptions = {
        from:
          options?.from || this.configService.get<string>('SMTP_FROM', 'noreply@claritybridge.com'),
        to: recipients,
        subject,
        text: content.text,
        html: content.html,
        replyTo: options?.replyTo,
        priority: options?.priority || 'normal',
        attachments: options?.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${recipients}`);

      return {
        success: true,
        messageId: result.messageId,
        provider: this.name,
      };
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);

      return {
        success: false,
        error: error.message,
        provider: this.name,
      };
    }
  }
}

// ============================================

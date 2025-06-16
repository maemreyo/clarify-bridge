//  Main notification service

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database';
import { JobQueueService, QueueName, JobType } from '@core/queue';
import { EmailProvider } from './providers/email.provider';
import { SlackProvider } from './providers/slack.provider';
import { EMAIL_TEMPLATES } from './templates/email.templates';
import { NotificationType } from '@prisma/client';

export interface NotificationData {
  userId?: string;
  email?: string;
  type: NotificationType;
  title: string;
  content?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailProvider: EmailProvider,
    private slackProvider: SlackProvider,
    private jobQueueService: JobQueueService,
  ) {}

  /**
   * Send notification to user (creates in-app notification and sends email if needed)
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    data: {
      title: string;
      content?: string;
      metadata?: Record<string, any>;
      sendEmail?: boolean;
    },
  ) {
    try {
      // Create in-app notification
      const notification = await this.prisma.notification.create({
        data: {
          recipientId: userId,
          type,
          title: data.title,
          message: data.content || '',
          data: data.metadata,
        },
      });

      this.logger.log(`In-app notification created for user ${userId}: ${type}`);

      // Send email notification if requested
      if (data.sendEmail !== false) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });

        if (user) {
          await this.sendEmailNotification(type, user.email, {
            ...data.metadata,
            name: user.name,
          });
        }
      }

      return notification;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send email notification based on type
   */
  async sendEmailNotification(type: NotificationType, email: string, data: Record<string, any>) {
    // Map notification type to email template

    const templateMap: Record<NotificationType, string> = {
      // Specification events
      [NotificationType.SPEC_CREATED]: 'SPEC_CREATED',
      [NotificationType.SPEC_UPDATED]: 'SPEC_UPDATED',
      [NotificationType.SPEC_APPROVED]: 'SPEC_APPROVED',
      [NotificationType.SPEC_REJECTED]: 'SPEC_REJECTED',
      [NotificationType.SPEC_COMPLETED]: 'SPEC_COMPLETED',

      // Collaboration events
      [NotificationType.COMMENT_ADDED]: 'COMMENT_ADDED',
      [NotificationType.COMMENT_REPLY]: 'COMMENT_REPLY',
      [NotificationType.REVIEW_REQUESTED]: 'REVIEW_REQUESTED',
      [NotificationType.REVIEW_COMPLETED]: 'REVIEW_COMPLETED',

      // Team events
      [NotificationType.TEAM_INVITATION]: 'TEAM_INVITATION',
      [NotificationType.MEMBER_JOINED]: 'MEMBER_JOINED',
      [NotificationType.MEMBER_LEFT]: 'MEMBER_LEFT',

      // Integration events
      [NotificationType.INTEGRATION_CREATED]: 'INTEGRATION_CREATED',
      [NotificationType.INTEGRATION_ERROR]: 'INTEGRATION_ERROR',
      [NotificationType.INTEGRATION_REMOVED]: 'INTEGRATION_REMOVED',

      // System events
      [NotificationType.USAGE_LIMIT_WARNING]: 'USAGE_LIMIT_WARNING',
      [NotificationType.SUBSCRIPTION_EXPIRING]: 'SUBSCRIPTION_EXPIRING',
      [NotificationType.SUBSCRIPTION_UPDATE]: 'SUBSCRIPTION_UPDATE',
      [NotificationType.SYSTEM_UPDATE]: 'SYSTEM_UPDATE',
      [NotificationType.SYSTEM_ALERT]: 'SYSTEM_ALERT',
    };

    const templateName = templateMap[type];
    if (!templateName || !EMAIL_TEMPLATES[templateName]) {
      this.logger.warn(`No email template found for notification type: ${type}`);
      return;
    }

    // Queue email job
    await this.jobQueueService.addJob(QueueName.NOTIFICATION, {
      type: JobType.SEND_EMAIL,
      payload: {
        template: templateName,
        recipients: [email],
        data,
      },
    });
  }

  /**
   * Send custom email
   */
  async sendEmail(
    recipients: string[],
    subject: string,
    content: { text?: string; html?: string },
    options?: any,
  ) {
    const result = await this.emailProvider.sendEmail(recipients, subject, content, options);

    if (!result.success) {
      throw new Error(`Failed to send email: ${result.error}`);
    }

    return result;
  }

  /**
   * Send email from template
   */
  async sendTemplatedEmail(
    recipients: string[],
    templateName: string,
    data: Record<string, any>,
    options?: any,
  ) {
    const templateFn = EMAIL_TEMPLATES[templateName];
    if (!templateFn) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    const template = templateFn(data);

    return this.sendEmail(
      recipients,
      template.subject,
      {
        text: template.text,
        html: template.html,
      },
      options,
    );
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: string,
    options?: {
      read?: boolean;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: any = { userId };

    if (options?.read !== undefined) {
      where.read = options.read;
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
    });

    const total = await this.prisma.notification.count({ where });

    return {
      notifications,
      total,
      unreadCount: await this.prisma.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (notification.count === 0) {
      throw new Error('Notification not found');
    }

    return { success: true };
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
        isRead: true,
      },
    });

    this.logger.log(`Cleaned up ${result.count} old notifications`);

    return { deleted: result.count };
  }

  /**
   * Send team notification
   */
  async sendTeamNotification(
    teamId: string,
    type: NotificationType,
    data: {
      title: string;
      content?: string;
      metadata?: Record<string, any>;
      excludeUserId?: string;
    },
  ) {
    const teamMembers = await this.prisma.teamMember.findMany({
      where: {
        teamId,
        userId: data.excludeUserId ? { not: data.excludeUserId } : undefined,
      },
      select: {
        userId: true,
      },
    });

    const notifications = await Promise.all(
      teamMembers.map(member => this.sendNotification(member.userId, type, data)),
    );

    return { sent: notifications.length };
  }
}

// ============================================

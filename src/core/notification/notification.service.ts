// Updated: Main notification service

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
          userId,
          type,
          title: data.title,
          content: data.content,
          metadata: data.metadata,
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
  async sendEmailNotification(
    type: NotificationType,
    email: string,
    data: Record<string, any>,
  ) {
    // Map notification type to email template
    const templateMap: Record<NotificationType, string> = {
      [NotificationType.SPEC_COMPLETED]: 'SPEC_COMPLETED',
      [NotificationType.COMMENT_ADDED]: 'COMMENT_ADDED',
      [NotificationType.REVIEW_REQUESTED]: 'REVIEW_REQUESTED',
      [NotificationType.REVIEW_COMPLETED]: 'REVIEW_COMPLETED',
      [NotificationType.TEAM_INVITATION]: 'TEAM_INVITATION',
      [NotificationType.SUBSCRIPTION_UPDATE]: 'SUBSCRIPTION_UPDATE',
      [NotificationType.SYSTEM_ALERT]: 'SYSTEM_ALERT',
    };

    const templateName = templateMap[type];
    if (!templateName || !EMAIL_TEMPLATES[templateName]) {
      this.logger.warn(`No email template found for notification type: ${type}`);
      return;
    }

    // Queue email job
    await this.jobQueueService.addJob(
      QueueName.NOTIFICATION,
      {
        type: JobType.SEND_EMAIL,
        payload: {
          template: templateName,
          recipients: [email],
          data,
        },
      },
    );
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
    const result = await this.emailProvider.sendEmail(
      recipients,
      subject,
      content,
      options,
    );

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
        where: { userId, read: false },
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
        userId,
      },
      data: {
        read: true,
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
        userId,
        read: false,
      },
      data: {
        read: true,
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
        read: true,
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
      teamMembers.map(member =>
        this.sendNotification(member.userId, type, data),
      ),
    );

    return { sent: notifications.length };
  }
}

// ============================================
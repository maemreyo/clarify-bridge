import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService, NotificationData } from './notification.service';
import { PrismaService } from '@core/database';
import { JobQueueService, QueueName, JobType } from '@core/queue';
import { EmailProvider } from './providers/email.provider';
import { SlackProvider } from './providers/slack.provider';
import { NotificationType } from '@prisma/client';
import { EMAIL_TEMPLATES } from './templates/email.templates';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: jest.Mocked<PrismaService>;
  let configService: jest.Mocked<ConfigService>;
  let emailProvider: jest.Mocked<EmailProvider>;
  let slackProvider: jest.Mocked<SlackProvider>;
  let jobQueueService: jest.Mocked<JobQueueService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockNotification = {
    id: 'notif-123',
    recipientId: 'user-123',
    type: NotificationType.SPECIFICATION_CREATED,
    title: 'Specification Created',
    message: 'Your specification has been created',
    data: { specId: 'spec-123' },
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: EmailProvider,
          useValue: {
            sendEmail: jest.fn(),
            isAvailable: jest.fn(),
          },
        },
        {
          provide: SlackProvider,
          useValue: {
            sendMessage: jest.fn(),
            isAvailable: jest.fn(),
          },
        },
        {
          provide: JobQueueService,
          useValue: {
            addJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
    emailProvider = module.get(EmailProvider);
    slackProvider = module.get(SlackProvider);
    jobQueueService = module.get(JobQueueService);

    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    it('should create in-app notification and send email', async () => {
      // Arrange
      const notificationData = {
        title: 'Test Notification',
        content: 'This is a test notification',
        metadata: { key: 'value' },
        sendEmail: true,
      };

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      emailProvider.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-123',
        provider: 'email',
      });

      // Act
      const result = await service.sendNotification(
        'user-123',
        NotificationType.SPECIFICATION_CREATED,
        notificationData,
      );

      // Assert
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          recipientId: 'user-123',
          type: NotificationType.SPECIFICATION_CREATED,
          title: notificationData.title,
          message: notificationData.content,
          data: notificationData.metadata,
        },
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { email: true, name: true },
      });
      expect(result).toEqual(mockNotification);
    });

    it('should create in-app notification without sending email', async () => {
      // Arrange
      const notificationData = {
        title: 'Test Notification',
        sendEmail: false,
      };

      prismaService.notification.create.mockResolvedValue(mockNotification);

      // Act
      const result = await service.sendNotification(
        'user-123',
        NotificationType.SPECIFICATION_CREATED,
        notificationData,
      );

      // Assert
      expect(prismaService.notification.create).toHaveBeenCalled();
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should handle missing user for email notification', async () => {
      // Arrange
      const notificationData = {
        title: 'Test Notification',
        sendEmail: true,
      };

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await service.sendNotification(
        'user-123',
        NotificationType.SPECIFICATION_CREATED,
        notificationData,
      );

      // Assert
      expect(emailProvider.sendEmail).not.toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should handle notification creation failure', async () => {
      // Arrange
      prismaService.notification.create.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(
        service.sendNotification('user-123', NotificationType.SPECIFICATION_CREATED, {
          title: 'Test',
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('sendEmailNotification', () => {
    it('should queue email job with correct data', async () => {
      // Arrange
      const metadata = { name: 'John', specTitle: 'Test Spec' };
      jobQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      // Act
      await service.sendEmailNotification(
        NotificationType.SPECIFICATION_CREATED,
        'test@example.com',
        metadata,
      );

      // Assert
      expect(jobQueueService.addJob).toHaveBeenCalledWith(
        QueueName.NOTIFICATION,
        {
          type: JobType.SEND_EMAIL,
          payload: {
            to: 'test@example.com',
            template: 'specificationCreated',
            data: metadata,
          },
        },
        { priority: 1 },
      );
    });

    it('should handle different notification types', async () => {
      // Arrange
      jobQueueService.addJob.mockResolvedValue({ id: 'job-123' } as any);

      const notificationTypes = [
        {
          type: NotificationType.SPECIFICATION_UPDATED,
          template: 'specificationUpdated',
        },
        {
          type: NotificationType.TEAM_INVITATION,
          template: 'teamInvitation',
        },
        {
          type: NotificationType.COMMENT_ADDED,
          template: 'commentAdded',
        },
      ];

      // Act & Assert
      for (const { type, template } of notificationTypes) {
        await service.sendEmailNotification(type, 'test@example.com', {});

        expect(jobQueueService.addJob).toHaveBeenCalledWith(
          QueueName.NOTIFICATION,
          expect.objectContaining({
            payload: expect.objectContaining({
              template,
            }),
          }),
          expect.any(Object),
        );
      }
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      // Arrange
      const recipients = ['user1@example.com', 'user2@example.com'];
      const subject = 'Test Email';
      const content = { text: 'Test content', html: '<p>Test content</p>' };

      emailProvider.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        provider: 'email',
      });

      // Act
      const result = await service.sendEmail(recipients, subject, content);

      // Assert
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(recipients, subject, content, undefined);
      expect(result).toEqual({
        success: true,
        messageId: 'msg-123',
        provider: 'email',
      });
    });

    it('should throw error when email sending fails', async () => {
      // Arrange
      emailProvider.sendEmail.mockResolvedValue({
        success: false,
        error: 'SMTP connection failed',
        provider: 'email',
      });

      // Act & Assert
      await expect(
        service.sendEmail(['test@example.com'], 'Subject', { text: 'Test' }),
      ).rejects.toThrow('Failed to send email: SMTP connection failed');
    });
  });

  describe('sendTemplatedEmail', () => {
    it('should send templated email successfully', async () => {
      // Arrange
      const templateName = 'specificationCreated';
      const data = { name: 'John', specTitle: 'New Spec' };

      emailProvider.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'msg-123',
        provider: 'email',
      });

      // Mock the template
      const mockTemplate = EMAIL_TEMPLATES[templateName](data);

      // Act
      const result = await service.sendTemplatedEmail(['test@example.com'], templateName, data);

      // Assert
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        ['test@example.com'],
        expect.any(String), // Template subject
        expect.objectContaining({
          text: expect.any(String),
          html: expect.any(String),
        }),
        undefined,
      );
      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent template', async () => {
      // Act & Assert
      await expect(
        service.sendTemplatedEmail(['test@example.com'], 'nonExistentTemplate', {}),
      ).rejects.toThrow('Email template not found: nonExistentTemplate');
    });
  });

  describe('getUserNotifications', () => {
    it('should retrieve user notifications with default options', async () => {
      // Arrange
      const notifications = [mockNotification, { ...mockNotification, id: 'notif-456' }];
      prismaService.notification.findMany.mockResolvedValue(notifications);

      // Act
      const result = await service.getUserNotifications('user-123');

      // Assert
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toEqual(notifications);
    });

    it('should filter by read status', async () => {
      // Arrange
      prismaService.notification.findMany.mockResolvedValue([mockNotification]);

      // Act
      await service.getUserNotifications('user-123', { read: false });

      // Assert
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user-123',
          read: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply pagination options', async () => {
      // Arrange
      prismaService.notification.findMany.mockResolvedValue([]);

      // Act
      await service.getUserNotifications('user-123', { limit: 50, offset: 100 });

      // Assert
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: { recipientId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 100,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Arrange
      prismaService.notification.count.mockResolvedValue(5);

      // Act
      const count = await service.getUnreadCount('user-123');

      // Assert
      expect(prismaService.notification.count).toHaveBeenCalledWith({
        where: {
          recipientId: 'user-123',
          read: false,
        },
      });
      expect(count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      // Arrange
      prismaService.notification.count.mockResolvedValue(0);

      // Act
      const count = await service.getUnreadCount('user-123');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark single notification as read', async () => {
      // Arrange
      const updatedNotification = { ...mockNotification, read: true };
      prismaService.notification.update.mockResolvedValue(updatedNotification);

      // Act
      const result = await service.markAsRead('user-123', 'notif-123');

      // Assert
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notif-123',
          recipientId: 'user-123',
        },
        data: { read: true },
      });
      expect(result.read).toBe(true);
    });

    it('should handle non-existent notification', async () => {
      // Arrange
      prismaService.notification.update.mockRejectedValue(new Error('Notification not found'));

      // Act & Assert
      await expect(service.markAsRead('user-123', 'non-existent')).rejects.toThrow(
        'Notification not found',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all user notifications as read', async () => {
      // Arrange
      prismaService.notification.updateMany.mockResolvedValue({ count: 10 });

      // Act
      const result = await service.markAllAsRead('user-123');

      // Assert
      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          recipientId: 'user-123',
          read: false,
        },
        data: { read: true },
      });
      expect(result).toEqual({ count: 10 });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      // Arrange
      prismaService.notification.delete.mockResolvedValue(mockNotification);

      // Act
      await service.deleteNotification('user-123', 'notif-123');

      // Assert
      expect(prismaService.notification.delete).toHaveBeenCalledWith({
        where: {
          id: 'notif-123',
          recipientId: 'user-123',
        },
      });
    });

    it('should handle deletion errors', async () => {
      // Arrange
      prismaService.notification.delete.mockRejectedValue(new Error('Delete failed'));

      // Act & Assert
      await expect(service.deleteNotification('user-123', 'notif-123')).rejects.toThrow(
        'Delete failed',
      );
    });
  });

  describe('sendSlackNotification', () => {
    it('should send Slack notification successfully', async () => {
      // Arrange
      const channel = '#general';
      const message = 'Test Slack message';

      slackProvider.sendMessage.mockResolvedValue({
        success: true,
        messageId: 'slack-123',
        provider: 'slack',
      });

      // Act
      const result = await service.sendSlackNotification(channel, message);

      // Assert
      expect(slackProvider.sendMessage).toHaveBeenCalledWith(channel, message, undefined);
      expect(result.success).toBe(true);
    });

    it('should handle Slack sending failure', async () => {
      // Arrange
      slackProvider.sendMessage.mockResolvedValue({
        success: false,
        error: 'Invalid channel',
        provider: 'slack',
      });

      // Act & Assert
      await expect(service.sendSlackNotification('#invalid', 'Test')).rejects.toThrow(
        'Failed to send Slack message: Invalid channel',
      );
    });
  });
});

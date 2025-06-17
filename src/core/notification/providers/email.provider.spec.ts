// UPDATED: 2025-06-17 - Added comprehensive email provider tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email.provider';
import { EmailOptions } from '../interfaces/notification-provider.interface';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer');

describe('EmailProvider', () => {
  let provider: EmailProvider;
  let configService: jest.Mocked<ConfigService>;
  let mockTransporter: jest.Mocked<any>;

  const mockSmtpConfig = {
    SMTP_HOST: 'smtp.test.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'test@example.com',
    SMTP_PASS: 'testpassword',
    SMTP_FROM: 'noreply@claritybridge.ai',
  };

  beforeEach(async () => {
    // Create mock transporter
    mockTransporter = {
      verify: jest.fn(),
      sendMail: jest.fn(),
    };

    // Mock nodemailer.createTransporter
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<EmailProvider>(EmailProvider);
    configService = module.get(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with valid SMTP configuration', () => {
      // Arrange
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          SMTP_HOST: mockSmtpConfig.SMTP_HOST,
          SMTP_PORT: mockSmtpConfig.SMTP_PORT,
          SMTP_SECURE: mockSmtpConfig.SMTP_SECURE,
          SMTP_USER: mockSmtpConfig.SMTP_USER,
          SMTP_PASS: mockSmtpConfig.SMTP_PASS,
        };
        return config[key] || defaultValue;
      });

      // Act
      const newProvider = new EmailProvider(configService);

      // Assert
      expect(newProvider.name).toBe('email');
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: mockSmtpConfig.SMTP_HOST,
        port: mockSmtpConfig.SMTP_PORT,
        secure: mockSmtpConfig.SMTP_SECURE,
        auth: {
          user: mockSmtpConfig.SMTP_USER,
          pass: mockSmtpConfig.SMTP_PASS,
        },
      });
    });

    it('should handle missing SMTP configuration gracefully', () => {
      // Arrange
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          SMTP_HOST: undefined,
          SMTP_USER: undefined,
          SMTP_PASS: undefined,
        };
        return config[key] || defaultValue;
      });

      const loggerSpy = jest.spyOn((provider as any).logger, 'warn').mockImplementation();

      // Act
      const newProvider = new EmailProvider(configService);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Email provider not configured - missing SMTP credentials'
      );
      expect((newProvider as any).isConfigured).toBe(false);
    });

    it('should log successful initialization', () => {
      // Arrange
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config = {
          SMTP_HOST: mockSmtpConfig.SMTP_HOST,
          SMTP_USER: mockSmtpConfig.SMTP_USER,
          SMTP_PASS: mockSmtpConfig.SMTP_PASS,
          SMTP_PORT: defaultValue,
          SMTP_SECURE: defaultValue,
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      });

      const loggerSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation();

      // Act
      new EmailProvider(configService);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Email provider initialized');
    });
  });

  describe('isAvailable', () => {
    beforeEach(() => {
      // Setup provider as configured
      (provider as any).isConfigured = true;
      (provider as any).transporter = mockTransporter;
    });

    it('should return false when not configured', async () => {
      // Arrange
      (provider as any).isConfigured = false;

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
      expect(mockTransporter.verify).not.toHaveBeenCalled();
    });

    it('should return true when SMTP verification succeeds', async () => {
      // Arrange
      mockTransporter.verify.mockResolvedValue(true);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('should return false when SMTP verification fails', async () => {
      // Arrange
      const error = new Error('SMTP connection failed');
      mockTransporter.verify.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
      expect(loggerSpy).toHaveBeenCalledWith('Email provider verification failed', error);
    });

    it('should handle authentication errors', async () => {
      // Arrange
      const authError = new Error('Invalid login: 535 Authentication failed');
      mockTransporter.verify.mockRejectedValue(authError);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('sendEmail', () => {
    beforeEach(() => {
      (provider as any).isConfigured = true;
      (provider as any).transporter = mockTransporter;
      configService.get.mockReturnValue('noreply@claritybridge.ai');
    });

    it('should send email to single recipient successfully', async () => {
      // Arrange
      const to = 'user@example.com';
      const subject = 'Test Email';
      const content = { text: 'Test content', html: '<p>Test content</p>' };
      const mockResult = { messageId: 'msg-123' };

      mockTransporter.sendMail.mockResolvedValue(mockResult);

      // Act
      const result = await provider.sendEmail(to, subject, content);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@claritybridge.ai',
        to: 'user@example.com',
        subject: 'Test Email',
        text: 'Test content',
        html: '<p>Test content</p>',
        replyTo: undefined,
        priority: 'normal',
        attachments: undefined,
      });

      expect(result).toEqual({
        success: true,
        messageId: 'msg-123',
        provider: 'email',
      });
    });

    it('should send email to multiple recipients', async () => {
      // Arrange
      const to = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
      const subject = 'Bulk Email';
      const content = { text: 'Bulk content' };
      const mockResult = { messageId: 'bulk-123' };

      mockTransporter.sendMail.mockResolvedValue(mockResult);

      // Act
      const result = await provider.sendEmail(to, subject, content);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user1@example.com, user2@example.com, user3@example.com',
          subject: 'Bulk Email',
          text: 'Bulk content',
        })
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('bulk-123');
    });

    it('should send email with custom options', async () => {
      // Arrange
      const to = 'user@example.com';
      const subject = 'Custom Email';
      const content = { html: '<h1>Custom HTML</h1>' };
      const options: EmailOptions = {
        from: 'custom@example.com',
        replyTo: 'reply@example.com',
        priority: 'high',
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('fake pdf content'),
            contentType: 'application/pdf',
          },
        ],
      };

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'custom-123' });

      // Act
      const result = await provider.sendEmail(to, subject, content, options);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'custom@example.com',
        to: 'user@example.com',
        subject: 'Custom Email',
        text: undefined,
        html: '<h1>Custom HTML</h1>',
        replyTo: 'reply@example.com',
        priority: 'high',
        attachments: options.attachments,
      });

      expect(result.success).toBe(true);
    });

    it('should handle text-only emails', async () => {
      // Arrange
      const to = 'user@example.com';
      const subject = 'Text Only';
      const content = { text: 'Plain text only content' };

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'text-123' });

      // Act
      const result = await provider.sendEmail(to, subject, content);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Plain text only content',
          html: undefined,
        })
      );

      expect(result.success).toBe(true);
    });

    it('should handle HTML-only emails', async () => {
      // Arrange
      const to = 'user@example.com';
      const subject = 'HTML Only';
      const content = { html: '<div><h1>HTML Content</h1><p>Rich formatting</p></div>' };

      mockTransporter.sendMail.mockResolvedValue({ messageId: 'html-123' });

      // Act
      const result = await provider.sendEmail(to, subject, content);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: undefined,
          html: '<div><h1>HTML Content</h1><p>Rich formatting</p></div>',
        })
      );

      expect(result.success).toBe(true);
    });

    it('should return error when provider not configured', async () => {
      // Arrange
      (provider as any).isConfigured = false;

      // Act
      const result = await provider.sendEmail('user@example.com', 'Test', { text: 'Test' });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Email provider not configured',
        provider: 'email',
      });

      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should handle SMTP send errors', async () => {
      // Arrange
      const error = new Error('SMTP send failed');
      mockTransporter.sendMail.mockRejectedValue(error);
      const loggerSpy = jest.spyOn((provider as any).logger, 'error').mockImplementation();

      // Act
      const result = await provider.sendEmail('user@example.com', 'Test', { text: 'Test' });

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'SMTP send failed',
        provider: 'email',
      });

      expect(loggerSpy).toHaveBeenCalledWith('Failed to send email: SMTP send failed');
    });

    it('should handle rate limiting errors', async () => {
      // Arrange
      const rateLimitError = new Error('Too many emails sent');
      mockTransporter.sendMail.mockRejectedValue(rateLimitError);

      // Act
      const result = await provider.sendEmail('user@example.com', 'Test', { text: 'Test' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Too many emails sent');
    });

    it('should log successful email sends', async () => {
      // Arrange
      const to = 'success@example.com';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'success-123' });
      const loggerSpy = jest.spyOn((provider as any).logger, 'log').mockImplementation();

      // Act
      await provider.sendEmail(to, 'Success', { text: 'Success' });

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Email sent successfully to success@example.com');
    });

    it('should handle empty recipient arrays gracefully', async () => {
      // Arrange
      const to: string[] = [];
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'empty-123' });

      // Act
      const result = await provider.sendEmail(to, 'Empty', { text: 'Test' });

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '',
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases and error scenarios', () => {
    beforeEach(() => {
      (provider as any).isConfigured = true;
      (provider as any).transporter = mockTransporter;
      configService.get.mockReturnValue('noreply@claritybridge.ai');
    });

    it('should handle very long subject lines', async () => {
      // Arrange
      const longSubject = 'A'.repeat(1000);
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'long-123' });

      // Act
      const result = await provider.sendEmail('test@example.com', longSubject, { text: 'Test' });

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: longSubject,
        })
      );
    });

    it('should handle special characters in email addresses', async () => {
      // Arrange
      const specialEmail = 'test+tag@example.co.uk';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'special-123' });

      // Act
      const result = await provider.sendEmail(specialEmail, 'Test', { text: 'Test' });

      // Assert
      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: specialEmail,
        })
      );
    });

    it('should handle large HTML content', async () => {
      // Arrange
      const largeHtml = '<div>' + 'Large content '.repeat(10000) + '</div>';
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'large-123' });

      // Act
      const result = await provider.sendEmail('test@example.com', 'Large', { html: largeHtml });

      // Assert
      expect(result.success).toBe(true);
    });

    it('should handle network timeout errors', async () => {
      // Arrange
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'ETIMEDOUT';
      mockTransporter.sendMail.mockRejectedValue(timeoutError);

      // Act
      const result = await provider.sendEmail('test@example.com', 'Test', { text: 'Test' });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle SSL/TLS connection errors', async () => {
      // Arrange
      const sslError = new Error('SSL connection failed');
      mockTransporter.verify.mockRejectedValue(sslError);

      // Act
      const result = await provider.isAvailable();

      // Assert
      expect(result).toBe(false);
    });

    it('should handle concurrent email sends', async () => {
      // Arrange
      const emails = Array.from({ length: 5 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: `Test ${i}`,
        content: { text: `Content ${i}` },
      }));

      mockTransporter.sendMail.mockImplementation(async () => ({ messageId: 'concurrent-123' }));

      // Act
      const promises = emails.map(email =>
        provider.sendEmail(email.to, email.subject, email.content)
      );
      const results = await Promise.all(promises);

      // Assert
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('configuration edge cases', () => {
    it('should handle partial SMTP configuration', () => {
      // Arrange
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const partialConfig = {
          SMTP_HOST: 'smtp.test.com',
          SMTP_USER: undefined, // Missing user
          SMTP_PASS: 'password',
        };
        return partialConfig[key] || defaultValue;
      });

      const loggerSpy = jest.spyOn((provider as any).logger, 'warn').mockImplementation();

      // Act
      new EmailProvider(configService);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Email provider not configured - missing SMTP credentials'
      );
    });

    it('should handle secure SMTP configuration', () => {
      // Arrange
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const secureConfig = {
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_PORT: 465,
          SMTP_SECURE: true,
          SMTP_USER: 'secure@gmail.com',
          SMTP_PASS: 'securepass',
        };
        return secureConfig[key] !== undefined ? secureConfig[key] : defaultValue;
      });

      // Act
      new EmailProvider(configService);

      // Assert
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'secure@gmail.com',
          pass: 'securepass',
        },
      });
    });
  });

  describe('provider properties', () => {
    it('should have correct provider name', () => {
      expect(provider.name).toBe('email');
    });

    it('should implement NotificationProvider interface', () => {
      expect(typeof provider.sendEmail).toBe('function');
      expect(typeof provider.isAvailable).toBe('function');
    });
  });
});
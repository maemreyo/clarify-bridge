// UPDATED: 2025-06-17 - Added comprehensive payment service tests

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PrismaService } from '@core/database';
import { NotificationService } from '@core/notification';
import { SubscriptionTier, SubscriptionStatus, NotificationType } from '@prisma/client';
import Stripe from 'stripe';
import {
  CheckoutSessionData,
  SubscriptionUpdateData,
  PRICING_CONFIG,
} from './interfaces/payment.interface';

// Mock Stripe
jest.mock('stripe');

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: jest.Mocked<ConfigService>;
  let prismaService: jest.Mocked<PrismaService>;
  let notificationService: jest.Mocked<NotificationService>;
  let stripeMock: jest.Mocked<Stripe>;

  const mockUserId = 'user-123';
  const mockCustomerId = 'cus_mock123';
  const mockSubscriptionId = 'sub_mock123';
  const mockSessionId = 'cs_mock123';

  const mockUser = {
    id: mockUserId,
    email: 'test@example.com',
    name: 'Test User',
    subscriptionTier: SubscriptionTier.FREE,
    subscription: null,
  };

  const mockUserWithSubscription = {
    ...mockUser,
    subscription: {
      id: 'subscription-123',
      stripeCustomerId: mockCustomerId,
      stripeSubscriptionId: mockSubscriptionId,
      status: SubscriptionStatus.ACTIVE,
      tier: SubscriptionTier.STARTER,
      interval: 'monthly',
      currentPeriodEnd: new Date('2024-07-15'),
      cancelAtPeriodEnd: false,
    },
  };

  const mockStripeCustomer = {
    id: mockCustomerId,
    email: 'test@example.com',
    name: 'Test User',
    metadata: { userId: mockUserId },
  };

  const mockStripeSession = {
    id: mockSessionId,
    url: 'https://checkout.stripe.com/session/cs_mock123',
    customer: mockCustomerId,
    metadata: {
      userId: mockUserId,
      tier: SubscriptionTier.STARTER,
      interval: 'monthly',
    },
  };

  const mockStripeSubscription = {
    id: mockSubscriptionId,
    customer: mockCustomerId,
    status: 'active',
    current_period_end: 1720915200, // July 15, 2024
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: {
            id: 'price_mock_starter_monthly',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    metadata: {
      userId: mockUserId,
      tier: SubscriptionTier.STARTER,
    },
  };

  beforeEach(async () => {
    // Create mock Stripe instance
    stripeMock = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      subscriptions: {
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
      invoices: {
        retrieve: jest.fn(),
      },
    } as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => stripeMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            subscription: {
              create: jest.fn(),
              update: jest.fn(),
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEmailNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
    notificationService = module.get(NotificationService);

    // Setup default config mock
    configService.get.mockImplementation((key: string) => {
      const config = {
        STRIPE_SECRET_KEY: 'sk_test_mock_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret',
      };
      return config[key];
    });

    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize Stripe when secret key is provided', () => {
      // Arrange
      configService.get.mockReturnValue('sk_test_mock_key');

      // Act
      new PaymentService(configService, prismaService, notificationService);

      // Assert
      expect(Stripe).toHaveBeenCalledWith('sk_test_mock_key', {
        apiVersion: '2023-10-16',
      });
    });

    it('should log warning when Stripe key is not configured', () => {
      // Arrange
      configService.get.mockReturnValue(undefined);
      const loggerSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation();

      // Act
      new PaymentService(configService, prismaService, notificationService);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Stripe secret key not configured');
    });
  });

  describe('createCheckoutSession', () => {
    const checkoutData: CheckoutSessionData = {
      userId: mockUserId,
      tier: SubscriptionTier.STARTER,
      interval: 'monthly',
      successUrl: 'https://app.example.com/success',
      cancelUrl: 'https://app.example.com/cancel',
    };

    beforeEach(() => {
      (service as any).stripe = stripeMock;
    });

    it('should create checkout session successfully for new customer', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      const result = await service.createCheckoutSession(checkoutData);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
        include: { subscription: true },
      });

      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
        metadata: { userId: mockUserId },
      });

      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: PRICING_CONFIG[SubscriptionTier.STARTER].stripePriceIdMonthly,
            quantity: 1,
          },
        ],
        success_url: checkoutData.successUrl,
        cancel_url: checkoutData.cancelUrl,
        metadata: {
          userId: mockUserId,
          tier: SubscriptionTier.STARTER,
          interval: 'monthly',
        },
        subscription_data: {
          metadata: {
            userId: mockUserId,
            tier: SubscriptionTier.STARTER,
          },
        },
      });

      expect(result).toBe('https://checkout.stripe.com/session/cs_mock123');
    });

    it('should create checkout session for existing customer', async () => {
      // Arrange
      const userWithCustomer = {
        ...mockUser,
        subscription: {
          stripeCustomerId: mockCustomerId,
          status: SubscriptionStatus.CANCELLED,
        },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      const result = await service.createCheckoutSession(checkoutData);

      // Assert
      expect(stripeMock.customers.create).not.toHaveBeenCalled();
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: mockCustomerId,
        })
      );
      expect(result).toBe('https://checkout.stripe.com/session/cs_mock123');
    });

    it('should handle yearly interval pricing', async () => {
      // Arrange
      const yearlyData = { ...checkoutData, interval: 'yearly' as const };
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      await service.createCheckoutSession(yearlyData);

      // Assert
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: PRICING_CONFIG[SubscriptionTier.STARTER].stripePriceIdYearly,
              quantity: 1,
            },
          ],
        })
      );
    });

    it('should handle different subscription tiers', async () => {
      // Arrange
      const tiers = [SubscriptionTier.STARTER, SubscriptionTier.PROFESSIONAL, SubscriptionTier.ENTERPRISE];

      for (const tier of tiers) {
        const tierData = { ...checkoutData, tier };
        prismaService.user.findUnique.mockResolvedValue(mockUser as any);
        stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
        stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

        // Act
        await service.createCheckoutSession(tierData);

        // Assert
        expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            line_items: [
              {
                price: PRICING_CONFIG[tier].stripePriceIdMonthly,
                quantity: 1,
              },
            ],
          })
        );

        jest.clearAllMocks();
      }
    });

    it('should throw error when Stripe is not configured', async () => {
      // Arrange
      (service as any).stripe = null;

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        'Payment system not configured'
      );
    });

    it('should throw error when user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(NotFoundException);
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow('User not found');
    });

    it('should throw error when user already has active subscription', async () => {
      // Arrange
      const userWithActiveSubscription = {
        ...mockUser,
        subscription: {
          ...mockUserWithSubscription.subscription,
          status: SubscriptionStatus.ACTIVE,
        },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithActiveSubscription as any);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(BadRequestException);
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        'User already has an active subscription'
      );
    });

    it('should throw error for FREE tier', async () => {
      // Arrange
      const freeData = { ...checkoutData, tier: SubscriptionTier.FREE };
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.createCheckoutSession(freeData)).rejects.toThrow(BadRequestException);
      await expect(service.createCheckoutSession(freeData)).rejects.toThrow(
        'Invalid subscription tier'
      );
    });

    it('should throw error when price is not configured', async () => {
      // Arrange
      const originalConfig = PRICING_CONFIG[SubscriptionTier.STARTER];
      (PRICING_CONFIG[SubscriptionTier.STARTER] as any).stripePriceIdMonthly = null;

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(BadRequestException);
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        'Price not configured for this tier'
      );

      // Restore original config
      PRICING_CONFIG[SubscriptionTier.STARTER] = originalConfig;
    });

    it('should handle Stripe API errors', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      stripeMock.customers.create.mockRejectedValue(new Error('Stripe API error'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        InternalServerErrorException
      );
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        'Failed to create payment session'
      );
      expect(loggerSpy).toHaveBeenCalledWith('Failed to create checkout session', expect.any(Error));
    });
  });

  describe('updateSubscription', () => {
    const updateData: SubscriptionUpdateData = {
      tier: SubscriptionTier.PROFESSIONAL,
      interval: 'yearly',
    };

    beforeEach(() => {
      (service as any).stripe = stripeMock;
    });

    it('should update subscription successfully', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue({
        ...mockStripeSubscription,
        items: {
          data: [
            {
              price: {
                id: PRICING_CONFIG[SubscriptionTier.PROFESSIONAL].stripePriceIdYearly,
                recurring: { interval: 'year' },
              },
            },
          ],
        },
      } as any);
      prismaService.subscription.update.mockResolvedValue({} as any);
      notificationService.sendEmailNotification.mockResolvedValue({} as any);

      // Act
      await service.updateSubscription(mockUserId, updateData);

      // Assert
      expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith(mockSubscriptionId);
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(mockSubscriptionId, {
        items: [
          {
            id: mockStripeSubscription.items.data[0].id,
            price: PRICING_CONFIG[SubscriptionTier.PROFESSIONAL].stripePriceIdYearly,
          },
        ],
        metadata: {
          userId: mockUserId,
          tier: SubscriptionTier.PROFESSIONAL,
        },
        proration_behavior: 'always_invoice',
      });

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockUserWithSubscription.subscription.id },
        data: {
          tier: SubscriptionTier.PROFESSIONAL,
          interval: 'yearly',
        },
      });
    });

    it('should update only tier when interval not specified', async () => {
      // Arrange
      const tierOnlyUpdate = { tier: SubscriptionTier.ENTERPRISE };
      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription as any);
      prismaService.subscription.update.mockResolvedValue({} as any);

      // Act
      await service.updateSubscription(mockUserId, tierOnlyUpdate);

      // Assert
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(mockSubscriptionId, {
        items: [
          {
            id: mockStripeSubscription.items.data[0].id,
            price: PRICING_CONFIG[SubscriptionTier.ENTERPRISE].stripePriceIdMonthly,
          },
        ],
        metadata: {
          userId: mockUserId,
          tier: SubscriptionTier.ENTERPRISE,
        },
        proration_behavior: 'always_invoice',
      });
    });

    it('should handle downgrade to FREE tier', async () => {
      // Arrange
      const freeUpdate = { tier: SubscriptionTier.FREE };
      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
      } as any);
      prismaService.subscription.update.mockResolvedValue({} as any);

      // Act
      await service.updateSubscription(mockUserId, freeUpdate);

      // Assert
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(mockSubscriptionId, {
        cancel_at_period_end: true,
        metadata: {
          userId: mockUserId,
          tier: SubscriptionTier.FREE,
        },
      });

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockUserWithSubscription.subscription.id },
        data: {
          tier: SubscriptionTier.FREE,
          cancelAtPeriodEnd: true,
        },
      });
    });

    it('should throw error when Stripe is not configured', async () => {
      // Arrange
      (service as any).stripe = null;

      // Act & Assert
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should throw error when user or subscription not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        'Subscription not found'
      );
    });

    it('should throw error when subscription is not active', async () => {
      // Arrange
      const userWithInactiveSubscription = {
        ...mockUserWithSubscription,
        subscription: {
          ...mockUserWithSubscription.subscription,
          status: SubscriptionStatus.CANCELLED,
        },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithInactiveSubscription as any);

      // Act & Assert
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        'No active subscription to update'
      );
    });

    it('should handle Stripe update errors', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      stripeMock.subscriptions.update.mockRejectedValue(new Error('Stripe update failed'));
      const loggerSpy = jest.spyOn((service as any).logger, 'error').mockImplementation();

      // Act & Assert
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        InternalServerErrorException
      );
      expect(loggerSpy).toHaveBeenCalledWith('Failed to update subscription', expect.any(Error));
    });
  });

  describe('cancelSubscription', () => {
    beforeEach(() => {
      (service as any).stripe = stripeMock;
    });

    it('should cancel subscription at period end', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
      } as any);
      prismaService.subscription.update.mockResolvedValue({} as any);
      notificationService.sendEmailNotification.mockResolvedValue({} as any);

      // Act
      await service.cancelSubscription(mockUserId);

      // Assert
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(mockSubscriptionId, {
        cancel_at_period_end: true,
      });

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockUserWithSubscription.subscription.id },
        data: { cancelAtPeriodEnd: true },
      });

      expect(notificationService.sendEmailNotification).toHaveBeenCalledWith(
        NotificationType.SUBSCRIPTION_CANCELLED,
        mockUserWithSubscription.email,
        expect.objectContaining({
          userName: mockUserWithSubscription.name,
          cancelDate: expect.any(String),
        })
      );
    });

    it('should throw error when Stripe is not configured', async () => {
      // Arrange
      (service as any).stripe = null;

      // Act & Assert
      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should throw error when user or subscription not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(NotFoundException);
    });

    it('should throw error when subscription is not active', async () => {
      // Arrange
      const userWithInactiveSubscription = {
        ...mockUserWithSubscription,
        subscription: {
          ...mockUserWithSubscription.subscription,
          status: SubscriptionStatus.CANCELLED,
        },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithInactiveSubscription as any);

      // Act & Assert
      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createCustomerPortalSession', () => {
    beforeEach(() => {
      (service as any).stripe = stripeMock;
    });

    it('should create customer portal session successfully', async () => {
      // Arrange
      const returnUrl = 'https://app.example.com/settings';
      const mockPortalSession = {
        url: 'https://billing.stripe.com/portal/session/bps_mock123',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.billingPortal.sessions.create.mockResolvedValue(mockPortalSession as any);

      // Act
      const result = await service.createCustomerPortalSession(mockUserId, returnUrl);

      // Assert
      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        return_url: returnUrl,
      });
      expect(result).toBe('https://billing.stripe.com/portal/session/bps_mock123');
    });

    it('should throw error when user has no subscription', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      // Act & Assert
      await expect(service.createCustomerPortalSession(mockUserId, 'https://app.example.com')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('handleWebhook', () => {
    const mockWebhookPayload = 'mock_payload';
    const mockSignature = 'mock_signature';
    const mockWebhookSecret = 'whsec_mock_secret';

    beforeEach(() => {
      (service as any).stripe = stripeMock;
      configService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_WEBHOOK_SECRET') return mockWebhookSecret;
        return 'default_value';
      });
    });

    it('should handle customer.subscription.updated event', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            ...mockStripeSubscription,
            status: 'past_due',
          },
        },
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      prismaService.subscription.update.mockResolvedValue({} as any);
      prismaService.user.update.mockResolvedValue({} as any);

      // Act
      await service.handleWebhook(mockWebhookPayload, mockSignature);

      // Assert
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        mockWebhookPayload,
        mockSignature,
        mockWebhookSecret
      );

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: mockSubscriptionId },
        data: {
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: new Date(mockStripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    });

    it('should handle customer.subscription.deleted event', async () => {
      // Arrange
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: mockStripeSubscription,
        },
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      prismaService.subscription.update.mockResolvedValue({} as any);
      prismaService.user.update.mockResolvedValue({} as any);

      // Act
      await service.handleWebhook(mockWebhookPayload, mockSignature);

      // Assert
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: mockSubscriptionId },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { subscriptionTier: SubscriptionTier.FREE },
      });
    });

    it('should handle invoice.payment_failed event', async () => {
      // Arrange
      const mockInvoice = {
        id: 'in_mock123',
        customer: mockCustomerId,
        subscription: mockSubscriptionId,
        hosted_invoice_url: 'https://invoice.stripe.com/i/mock123',
      };

      const mockEvent = {
        type: 'invoice.payment_failed',
        data: { object: mockInvoice },
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      stripeMock.invoices.retrieve.mockResolvedValue(mockInvoice as any);
      prismaService.user.findFirst.mockResolvedValue(mockUserWithSubscription as any);
      notificationService.sendEmailNotification.mockResolvedValue({} as any);

      // Act
      await service.handleWebhook(mockWebhookPayload, mockSignature);

      // Assert
      expect(notificationService.sendEmailNotification).toHaveBeenCalledWith(
        NotificationType.PAYMENT_FAILED,
        mockUserWithSubscription.email,
        expect.objectContaining({
          userName: mockUserWithSubscription.name,
          invoiceUrl: mockInvoice.hosted_invoice_url,
        })
      );
    });

    it('should handle unrecognized webhook events gracefully', async () => {
      // Arrange
      const mockEvent = {
        type: 'unknown.event.type',
        data: { object: {} },
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(mockEvent as any);
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();

      // Act
      await service.handleWebhook(mockWebhookPayload, mockSignature);

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith('Unhandled webhook event: unknown.event.type');
    });

    it('should throw error on webhook signature verification failure', async () => {
      // Arrange
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      await expect(service.handleWebhook(mockWebhookPayload, 'invalid_signature')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('mapStripeStatus', () => {
    it('should map Stripe statuses correctly', () => {
      // Arrange & Act & Assert
      expect((service as any).mapStripeStatus('active')).toBe(SubscriptionStatus.ACTIVE);
      expect((service as any).mapStripeStatus('canceled')).toBe(SubscriptionStatus.CANCELLED);
      expect((service as any).mapStripeStatus('past_due')).toBe(SubscriptionStatus.PAST_DUE);
      expect((service as any).mapStripeStatus('unpaid')).toBe(SubscriptionStatus.UNPAID);
      expect((service as any).mapStripeStatus('unknown_status')).toBe(SubscriptionStatus.CANCELLED);
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(() => {
      (service as any).stripe = stripeMock;
    });

    it('should handle concurrent requests gracefully', async () => {
      // Arrange
      const checkoutData: CheckoutSessionData = {
        userId: mockUserId,
        tier: SubscriptionTier.STARTER,
        interval: 'monthly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      const promises = Array.from({ length: 3 }, () => service.createCheckoutSession(checkoutData));
      const results = await Promise.all(promises);

      // Assert
      results.forEach(result => {
        expect(result).toBe('https://checkout.stripe.com/session/cs_mock123');
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const updateData: SubscriptionUpdateData = { tier: SubscriptionTier.PROFESSIONAL };

      prismaService.user.findUnique.mockResolvedValue(mockUserWithSubscription as any);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription as any);
      prismaService.subscription.update.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.updateSubscription(mockUserId, updateData)).rejects.toThrow(
        InternalServerErrorException
      );
    });

    it('should handle network timeout errors', async () => {
      // Arrange
      const checkoutData: CheckoutSessionData = {
        userId: mockUserId,
        tier: SubscriptionTier.STARTER,
        interval: 'monthly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser as any);
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      stripeMock.customers.create.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        InternalServerErrorException
      );
    });
  });
});
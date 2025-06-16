import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
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

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscriptionTier: SubscriptionTier.FREE,
    subscription: null,
  };

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    stripeCustomerId: 'cus-123',
    stripeSubscriptionId: 'stripe-sub-123',
    status: SubscriptionStatus.ACTIVE,
    tier: SubscriptionTier.PREMIUM,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStripeCustomer = {
    id: 'cus-123',
    email: 'test@example.com',
  };

  const mockStripeSession = {
    id: 'cs-123',
    url: 'https://checkout.stripe.com/session/cs-123',
  };

  const mockStripeSubscription = {
    id: 'stripe-sub-123',
    customer: 'cus-123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    items: {
      data: [
        {
          price: {
            id: 'price-123',
            recurring: { interval: 'month' },
          },
        },
      ],
    },
    metadata: {
      userId: 'user-123',
      tier: 'PREMIUM',
    },
  };

  beforeEach(async () => {
    // Create Stripe mock instance
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
    } as any;

    // Mock Stripe constructor
    (Stripe as any).mockImplementation(() => stripeMock);

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
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
    notificationService = module.get(NotificationService);

    // Setup default config
    configService.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_123';
      return null;
    });

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with Stripe when secret key is provided', () => {
      expect(Stripe).toHaveBeenCalledWith('sk_test_123', {
        apiVersion: '2023-10-16',
      });
    });

    it('should log warning when Stripe key is not configured', async () => {
      // Re-create service without Stripe key
      configService.get.mockReturnValue(null);

      const moduleWithoutStripe = await Test.createTestingModule({
        providers: [
          PaymentService,
          { provide: ConfigService, useValue: configService },
          { provide: PrismaService, useValue: prismaService },
          { provide: NotificationService, useValue: notificationService },
        ],
      }).compile();

      const serviceWithoutStripe = moduleWithoutStripe.get<PaymentService>(PaymentService);
      expect(serviceWithoutStripe).toBeDefined();
    });
  });

  describe('createCheckoutSession', () => {
    const checkoutData: CheckoutSessionData = {
      userId: 'user-123',
      tier: SubscriptionTier.PREMIUM,
      interval: 'monthly',
      successUrl: 'https://app.com/success',
      cancelUrl: 'https://app.com/cancel',
    };

    it('should create checkout session for new subscription', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      const result = await service.createCheckoutSession(checkoutData);

      // Assert
      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
        metadata: { userId: mockUser.id },
      });
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith({
        customer: 'cus-123',
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: PRICING_CONFIG[SubscriptionTier.PREMIUM].stripePriceIdMonthly,
            quantity: 1,
          },
        ],
        success_url: checkoutData.successUrl,
        cancel_url: checkoutData.cancelUrl,
        metadata: {
          userId: mockUser.id,
          tier: checkoutData.tier,
          interval: checkoutData.interval,
        },
        subscription_data: {
          metadata: {
            userId: mockUser.id,
            tier: checkoutData.tier,
          },
        },
      });
      expect(result).toBe('https://checkout.stripe.com/session/cs-123');
    });

    it('should use existing Stripe customer if available', async () => {
      // Arrange
      const userWithSubscription = {
        ...mockUser,
        subscription: { ...mockSubscription, status: SubscriptionStatus.CANCELLED },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      await service.createCheckoutSession(checkoutData);

      // Assert
      expect(stripeMock.customers.create).not.toHaveBeenCalled();
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus-123',
        }),
      );
    });

    it('should throw error if payment system not configured', async () => {
      // Arrange
      configService.get.mockReturnValue(null);
      const serviceWithoutStripe = new PaymentService(
        configService,
        prismaService,
        notificationService,
      );

      // Act & Assert
      await expect(serviceWithoutStripe.createCheckoutSession(checkoutData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if user already has active subscription', async () => {
      // Arrange
      const userWithActiveSubscription = {
        ...mockUser,
        subscription: mockSubscription,
      };
      prismaService.user.findUnique.mockResolvedValue(userWithActiveSubscription);

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle yearly interval pricing', async () => {
      // Arrange
      const yearlyData = { ...checkoutData, interval: 'yearly' as const };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer as any);
      stripeMock.checkout.sessions.create.mockResolvedValue(mockStripeSession as any);

      // Act
      await service.createCheckoutSession(yearlyData);

      // Assert
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: PRICING_CONFIG[SubscriptionTier.PREMIUM].stripePriceIdYearly,
              quantity: 1,
            },
          ],
        }),
      );
    });

    it('should handle Stripe API errors', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      stripeMock.customers.create.mockRejectedValue(new Error('Stripe API error'));

      // Act & Assert
      await expect(service.createCheckoutSession(checkoutData)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('updateSubscription', () => {
    const updateData: SubscriptionUpdateData = {
      tier: SubscriptionTier.BUSINESS,
      interval: 'yearly',
    };

    it('should update subscription successfully', async () => {
      // Arrange
      const userWithSubscription = { ...mockUser, subscription: mockSubscription };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      stripeMock.subscriptions.update.mockResolvedValue({
        ...mockStripeSubscription,
        items: {
          data: [
            {
              price: {
                id: PRICING_CONFIG[SubscriptionTier.BUSINESS].stripePriceIdYearly,
              },
            },
          ],
        },
      } as any);

      // Act
      await service.updateSubscription('user-123', updateData);

      // Assert
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        'stripe-sub-123',
        {
          items: [
            {
              id: mockStripeSubscription.items.data[0].id,
              price: PRICING_CONFIG[SubscriptionTier.BUSINESS].stripePriceIdYearly,
            },
          ],
          proration_behavior: 'create_prorations',
        },
      );
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: { tier: SubscriptionTier.BUSINESS },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { subscriptionTier: SubscriptionTier.BUSINESS },
      });
    });

    it('should throw error if subscription not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.updateSubscription('user-123', updateData)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if subscription not active', async () => {
      // Arrange
      const userWithInactiveSubscription = {
        ...mockUser,
        subscription: { ...mockSubscription, status: SubscriptionStatus.CANCELLED },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithInactiveSubscription);

      // Act & Assert
      await expect(service.updateSubscription('user-123', updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should downgrade to FREE tier correctly', async () => {
      // Arrange
      const downgradeData: SubscriptionUpdateData = { tier: SubscriptionTier.FREE };
      const userWithSubscription = { ...mockUser, subscription: mockSubscription };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);
      stripeMock.subscriptions.cancel.mockResolvedValue({
        ...mockStripeSubscription,
        status: 'canceled',
      } as any);

      // Act
      await service.updateSubscription('user-123', downgradeData);

      // Assert
      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('stripe-sub-123', {
        prorate: true,
      });
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      // Arrange
      const userWithSubscription = {
        ...mockUser,
        subscription: { ...mockSubscription, stripeSubscriptionId: 'stripe-sub-123' },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);
      stripeMock.subscriptions.update.mockResolvedValue({
        ...mockStripeSubscription,
        cancel_at_period_end: true,
      } as any);

      // Act
      await service.cancelSubscription('user-123');

      // Assert
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith('stripe-sub-123', {
        cancel_at_period_end: true,
      });
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        'user-123',
        NotificationType.SUBSCRIPTION_UPDATE,
        expect.objectContaining({
          title: 'Subscription Cancellation Scheduled',
        }),
      );
    });

    it('should throw error if no active subscription', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.cancelSubscription('user-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleWebhookEvent', () => {
    const mockPayload = 'raw-webhook-payload';
    const mockSignature = 'stripe-signature';

    it('should handle checkout.session.completed event', async () => {
      // Arrange
      const checkoutSession = {
        id: 'cs-123',
        customer: 'cus-123',
        subscription: 'stripe-sub-123',
        metadata: {
          userId: 'user-123',
          tier: 'PREMIUM',
        },
      };

      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: checkoutSession },
      } as any);

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      stripeMock.subscriptions.retrieve.mockResolvedValue(mockStripeSubscription as any);
      prismaService.$transaction.mockImplementation(async (callback) => callback(prismaService));

      // Act
      await service.handleWebhookEvent(mockPayload, mockSignature);

      // Assert
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        mockPayload,
        mockSignature,
        'whsec_123',
      );
      expect(prismaService.subscription.create).toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { subscriptionTier: SubscriptionTier.PREMIUM },
      });
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated event', async () => {
      // Arrange
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: { object: mockStripeSubscription },
      } as any);

      prismaService.subscription.findUnique.mockResolvedValue(mockSubscription);

      // Act
      await service.handleWebhookEvent(mockPayload, mockSignature);

      // Assert
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: {
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
          status: SubscriptionStatus.ACTIVE,
        },
      });
    });

    it('should handle customer.subscription.deleted event', async () => {
      // Arrange
      stripeMock.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: mockStripeSubscription },
      } as any);

      prismaService.subscription.findUnique.mockResolvedValue(mockSubscription);

      // Act
      await service.handleWebhookEvent(mockPayload, mockSignature);

      // Assert
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: { status: SubscriptionStatus.CANCELLED },
      });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { subscriptionTier: SubscriptionTier.FREE },
      });
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    it('should handle invalid webhook signature', async () => {
      // Arrange
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      await expect(service.handleWebhookEvent(mockPayload, mockSignature)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if webhook secret not configured', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123';
        if (key === 'STRIPE_WEBHOOK_SECRET') return null;
        return null;
      });

      // Act & Assert
      await expect(service.handleWebhookEvent(mockPayload, mockSignature)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should return subscription details for subscribed user', async () => {
      // Arrange
      const userWithSubscription = {
        ...mockUser,
        subscriptionTier: SubscriptionTier.PREMIUM,
        subscription: mockSubscription,
      };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);

      // Act
      const result = await service.getSubscriptionDetails('user-123');

      // Assert
      expect(result).toEqual({
        currentTier: SubscriptionTier.PREMIUM,
        subscription: {
          status: mockSubscription.status,
          currentPeriodEnd: mockSubscription.currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        availableTiers: expect.any(Array),
      });
    });

    it('should return details for free tier user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act
      const result = await service.getSubscriptionDetails('user-123');

      // Assert
      expect(result).toEqual({
        currentTier: SubscriptionTier.FREE,
        subscription: null,
        availableTiers: expect.any(Array),
      });
    });

    it('should throw error if user not found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getSubscriptionDetails('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createCustomerPortalSession', () => {
    it('should create portal session successfully', async () => {
      // Arrange
      const userWithSubscription = {
        ...mockUser,
        subscription: { ...mockSubscription, stripeCustomerId: 'cus-123' },
      };
      prismaService.user.findUnique.mockResolvedValue(userWithSubscription);
      stripeMock.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/xyz',
      } as any);

      // Act
      const result = await service.createCustomerPortalSession(
        'user-123',
        'https://app.com/settings',
      );

      // Assert
      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus-123',
        return_url: 'https://app.com/settings',
      });
      expect(result).toBe('https://billing.stripe.com/session/xyz');
    });

    it('should throw error if no subscription found', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        service.createCustomerPortalSession('user-123', 'https://app.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
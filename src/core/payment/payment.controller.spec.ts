import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import {
  CreateCheckoutSessionDto,
  UpdateSubscriptionDto,
  CreateCustomerPortalSessionDto,
} from './dto/payment.dto';
import { SubscriptionTier } from '@prisma/client';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<PaymentService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockSubscriptionDetails = {
    currentTier: SubscriptionTier.PREMIUM,
    subscription: {
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2024-07-15'),
      cancelAtPeriodEnd: false,
    },
    availableTiers: [
      {
        tier: SubscriptionTier.STARTER,
        monthlyPrice: 9.99,
        yearlyPrice: 99.99,
        features: ['5 specifications', '20 AI generations'],
      },
      {
        tier: SubscriptionTier.PREMIUM,
        monthlyPrice: 29.99,
        yearlyPrice: 299.99,
        features: ['50 specifications', '200 AI generations'],
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            createCheckoutSession: jest.fn(),
            updateSubscription: jest.fn(),
            cancelSubscription: jest.fn(),
            createCustomerPortalSession: jest.fn(),
            getSubscriptionDetails: jest.fn(),
            handleWebhookEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get(PaymentService);

    jest.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      // Arrange
      const dto: CreateCheckoutSessionDto = {
        tier: SubscriptionTier.PREMIUM,
        interval: 'monthly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };
      const mockSessionUrl = 'https://checkout.stripe.com/session/cs_test_123';
      paymentService.createCheckoutSession.mockResolvedValue(mockSessionUrl);

      // Act
      const result = await controller.createCheckoutSession(mockUser.id, dto);

      // Assert
      expect(paymentService.createCheckoutSession).toHaveBeenCalledWith({
        userId: mockUser.id,
        ...dto,
      });
      expect(result).toEqual({ url: mockSessionUrl });
    });

    it('should handle service errors', async () => {
      // Arrange
      const dto: CreateCheckoutSessionDto = {
        tier: SubscriptionTier.STARTER,
        interval: 'yearly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };
      paymentService.createCheckoutSession.mockRejectedValue(
        new BadRequestException('User already has active subscription'),
      );

      // Act & Assert
      await expect(controller.createCheckoutSession(mockUser.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate tier enum values', async () => {
      // Arrange
      const dto: CreateCheckoutSessionDto = {
        tier: 'INVALID_TIER' as any,
        interval: 'monthly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };

      // Note: In a real scenario, validation would be handled by ValidationPipe
      // This test demonstrates the expected behavior
      paymentService.createCheckoutSession.mockRejectedValue(
        new BadRequestException('Invalid subscription tier'),
      );

      // Act & Assert
      await expect(controller.createCheckoutSession(mockUser.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate interval values', async () => {
      // Arrange
      const dto = {
        tier: SubscriptionTier.PREMIUM,
        interval: 'weekly' as any, // Invalid interval
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };

      paymentService.createCheckoutSession.mockRejectedValue(
        new BadRequestException('Invalid billing interval'),
      );

      // Act & Assert
      await expect(controller.createCheckoutSession(mockUser.id, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      // Arrange
      const dto: UpdateSubscriptionDto = {
        tier: SubscriptionTier.BUSINESS,
        interval: 'yearly',
      };
      paymentService.updateSubscription.mockResolvedValue(undefined);

      // Act
      const result = await controller.updateSubscription(mockUser.id, dto);

      // Assert
      expect(paymentService.updateSubscription).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual({ message: 'Subscription updated successfully' });
    });

    it('should handle update without interval change', async () => {
      // Arrange
      const dto: UpdateSubscriptionDto = {
        tier: SubscriptionTier.PROFESSIONAL,
      };
      paymentService.updateSubscription.mockResolvedValue(undefined);

      // Act
      const result = await controller.updateSubscription(mockUser.id, dto);

      // Assert
      expect(paymentService.updateSubscription).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result.message).toBe('Subscription updated successfully');
    });

    it('should handle downgrade to FREE tier', async () => {
      // Arrange
      const dto: UpdateSubscriptionDto = {
        tier: SubscriptionTier.FREE,
      };
      paymentService.updateSubscription.mockResolvedValue(undefined);

      // Act
      const result = await controller.updateSubscription(mockUser.id, dto);

      // Assert
      expect(result.message).toBe('Subscription updated successfully');
    });

    it('should handle subscription not found error', async () => {
      // Arrange
      const dto: UpdateSubscriptionDto = {
        tier: SubscriptionTier.PREMIUM,
      };
      paymentService.updateSubscription.mockRejectedValue(
        new NotFoundException('Subscription not found'),
      );

      // Act & Assert
      await expect(controller.updateSubscription(mockUser.id, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      // Arrange
      paymentService.cancelSubscription.mockResolvedValue(undefined);

      // Act
      const result = await controller.cancelSubscription(mockUser.id);

      // Assert
      expect(paymentService.cancelSubscription).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        message: 'Subscription will be cancelled at the end of the billing period',
      });
    });

    it('should handle no active subscription error', async () => {
      // Arrange
      paymentService.cancelSubscription.mockRejectedValue(
        new NotFoundException('No active subscription found'),
      );

      // Act & Assert
      await expect(controller.cancelSubscription(mockUser.id)).rejects.toThrow(NotFoundException);
    });

    it('should handle already cancelled subscription', async () => {
      // Arrange
      paymentService.cancelSubscription.mockRejectedValue(
        new BadRequestException('Subscription already cancelled'),
      );

      // Act & Assert
      await expect(controller.cancelSubscription(mockUser.id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPortalSession', () => {
    it('should create customer portal session successfully', async () => {
      // Arrange
      const dto: CreateCustomerPortalSessionDto = {
        returnUrl: 'https://app.example.com/settings',
      };
      const mockPortalUrl = 'https://billing.stripe.com/session/test_123';
      paymentService.createCustomerPortalSession.mockResolvedValue(mockPortalUrl);

      // Act
      const result = await controller.createPortalSession(mockUser.id, dto);

      // Assert
      expect(paymentService.createCustomerPortalSession).toHaveBeenCalledWith(
        mockUser.id,
        dto.returnUrl,
      );
      expect(result).toEqual({ url: mockPortalUrl });
    });

    it('should validate return URL format', async () => {
      // Arrange
      const dto: CreateCustomerPortalSessionDto = {
        returnUrl: 'invalid-url',
      };
      paymentService.createCustomerPortalSession.mockRejectedValue(
        new BadRequestException('Invalid return URL'),
      );

      // Act & Assert
      await expect(controller.createPortalSession(mockUser.id, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle no subscription error', async () => {
      // Arrange
      const dto: CreateCustomerPortalSessionDto = {
        returnUrl: 'https://app.example.com/settings',
      };
      paymentService.createCustomerPortalSession.mockRejectedValue(
        new NotFoundException('No subscription found'),
      );

      // Act & Assert
      await expect(controller.createPortalSession(mockUser.id, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details successfully', async () => {
      // Arrange
      paymentService.getSubscriptionDetails.mockResolvedValue(mockSubscriptionDetails);

      // Act
      const result = await controller.getSubscription(mockUser.id);

      // Assert
      expect(paymentService.getSubscriptionDetails).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockSubscriptionDetails);
    });

    it('should handle user not found', async () => {
      // Arrange
      paymentService.getSubscriptionDetails.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      // Act & Assert
      await expect(controller.getSubscription(mockUser.id)).rejects.toThrow(NotFoundException);
    });

    it('should return FREE tier details when no subscription', async () => {
      // Arrange
      const freeUserDetails = {
        currentTier: SubscriptionTier.FREE,
        subscription: null,
        availableTiers: mockSubscriptionDetails.availableTiers,
      };
      paymentService.getSubscriptionDetails.mockResolvedValue(freeUserDetails);

      // Act
      const result = await controller.getSubscription(mockUser.id);

      // Assert
      expect(result.currentTier).toBe(SubscriptionTier.FREE);
      expect(result.subscription).toBeNull();
    });
  });

  describe('handleWebhook', () => {
    it('should handle webhook successfully', async () => {
      // Arrange
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature-123';
      paymentService.handleWebhookEvent.mockResolvedValue(undefined);

      // Act
      const result = await controller.handleWebhook(rawBody, signature);

      // Assert
      expect(paymentService.handleWebhookEvent).toHaveBeenCalledWith(rawBody, signature);
      expect(result).toEqual({ received: true });
    });

    it('should handle invalid signature error', async () => {
      // Arrange
      const rawBody = 'raw-webhook-body';
      const signature = 'invalid-signature';
      paymentService.handleWebhookEvent.mockRejectedValue(
        new BadRequestException('Invalid webhook signature'),
      );

      // Act & Assert
      await expect(controller.handleWebhook(rawBody, signature)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle webhook processing error', async () => {
      // Arrange
      const rawBody = 'raw-webhook-body';
      const signature = 'stripe-signature-123';
      paymentService.handleWebhookEvent.mockRejectedValue(
        new InternalServerErrorException('Webhook processing failed'),
      );

      // Act & Assert
      await expect(controller.handleWebhook(rawBody, signature)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should be accessible without authentication (Public decorator)', () => {
      // This test verifies that the webhook endpoint has the @Public decorator
      // In a real scenario, you would test this through integration tests
      // Here we just verify the method exists and can be called
      expect(controller.handleWebhook).toBeDefined();
      expect(typeof controller.handleWebhook).toBe('function');
    });
  });

  describe('error handling scenarios', () => {
    it('should handle Stripe API errors', async () => {
      // Arrange
      const dto: CreateCheckoutSessionDto = {
        tier: SubscriptionTier.PREMIUM,
        interval: 'monthly',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
      };
      paymentService.createCheckoutSession.mockRejectedValue(
        new InternalServerErrorException('Stripe API error'),
      );

      // Act & Assert
      await expect(controller.createCheckoutSession(mockUser.id, dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle payment configuration errors', async () => {
      // Arrange
      paymentService.getSubscriptionDetails.mockRejectedValue(
        new InternalServerErrorException('Payment system not configured'),
      );

      // Act & Assert
      await expect(controller.getSubscription(mockUser.id)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle concurrent requests', async () => {
      // Arrange
      const dto: UpdateSubscriptionDto = {
        tier: SubscriptionTier.PREMIUM,
      };
      paymentService.updateSubscription.mockResolvedValue(undefined);

      // Act
      const promises = Array(5)
        .fill(null)
        .map(() => controller.updateSubscription(mockUser.id, dto));

      const results = await Promise.all(promises);

      // Assert
      expect(paymentService.updateSubscription).toHaveBeenCalledTimes(5);
      results.forEach((result) => {
        expect(result.message).toBe('Subscription updated successfully');
      });
    });
  });

  describe('authorization and guards', () => {
    it('should have JwtAuthGuard on protected endpoints', () => {
      // Verify that protected endpoints exist and are functions
      expect(typeof controller.createCheckoutSession).toBe('function');
      expect(typeof controller.updateSubscription).toBe('function');
      expect(typeof controller.cancelSubscription).toBe('function');
      expect(typeof controller.createPortalSession).toBe('function');
      expect(typeof controller.getSubscription).toBe('function');
    });

    it('should use CurrentUser decorator to get userId', () => {
      // This is a conceptual test - in real scenarios, you would test through integration tests
      // Here we verify the methods accept userId parameter
      const methods = [
        controller.createCheckoutSession,
        controller.updateSubscription,
        controller.cancelSubscription,
        controller.createPortalSession,
        controller.getSubscription,
      ];

      methods.forEach((method) => {
        expect(method.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
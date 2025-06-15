// Updated: Payment and subscription management service

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database';
import { NotificationService } from '@core/notification';
import { SubscriptionTier, SubscriptionStatus, NotificationType } from '@prisma/client';
import Stripe from 'stripe';
import {
  CheckoutSessionData,
  SubscriptionUpdateData,
  PRICING_CONFIG,
} from './interfaces/payment.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      this.logger.warn('Stripe secret key not configured');
    } else {
      this.stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2023-10-16',
      });
    }
  }

  /**
   * Create Stripe checkout session
   */
  async createCheckoutSession(data: CheckoutSessionData): Promise<string> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Payment system not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.subscription && user.subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('User already has an active subscription');
    }

    const priceConfig = PRICING_CONFIG[data.tier];
    if (!priceConfig || data.tier === SubscriptionTier.FREE) {
      throw new BadRequestException('Invalid subscription tier');
    }

    const priceId = data.interval === 'yearly'
      ? priceConfig.stripePriceIdYearly
      : priceConfig.stripePriceIdMonthly;

    if (!priceId) {
      throw new BadRequestException('Price not configured for this tier');
    }

    try {
      // Create or get Stripe customer
      let customerId = user.subscription?.stripeCustomerId;

      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: user.email,
          name: user.name || undefined,
          metadata: {
            userId: user.id,
          },
        });
        customerId = customer.id;
      }

      // Create checkout session
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: {
          userId: user.id,
          tier: data.tier,
          interval: data.interval,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            tier: data.tier,
          },
        },
      });

      this.logger.log(`Checkout session created for user ${user.id}`);
      return session.url!;
    } catch (error) {
      this.logger.error('Failed to create checkout session', error);
      throw new InternalServerErrorException('Failed to create payment session');
    }
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    userId: string,
    data: SubscriptionUpdateData,
  ): Promise<void> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Payment system not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (user.subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('No active subscription to update');
    }

    const priceConfig = PRICING_CONFIG[data.tier];
    if (!priceConfig || data.tier === SubscriptionTier.FREE) {
      throw new BadRequestException('Invalid subscription tier');
    }

    try {
      // Get current subscription from Stripe
      const subscription = await this.stripe.subscriptions.retrieve(
        user.subscription.stripeSubscriptionId!,
      );

      // Determine new price
      const currentInterval = subscription.items.data[0].price.recurring?.interval;
      const interval = data.interval || (currentInterval === 'year' ? 'yearly' : 'monthly');
      const priceId = interval === 'yearly'
        ? priceConfig.stripePriceIdYearly
        : priceConfig.stripePriceIdMonthly;

      if (!priceId) {
        throw new BadRequestException('Price not configured for this tier');
      }

      // Update subscription
      await this.stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
        metadata: {
          tier: data.tier,
        },
      });

      // Update database
      await this.prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { tier: data.tier },
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: { subscriptionTier: data.tier },
      });

      // Send notification
      await this.notificationService.sendNotification(
        userId,
        NotificationType.SUBSCRIPTION_UPDATE,
        {
          title: 'Subscription Updated',
          content: `Your subscription has been updated to ${priceConfig.name}`,
          metadata: { tier: data.tier },
        },
      );

      this.logger.log(`Subscription updated for user ${userId} to ${data.tier}`);
    } catch (error) {
      this.logger.error('Failed to update subscription', error);
      throw new InternalServerErrorException('Failed to update subscription');
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<void> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Payment system not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (user.subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('No active subscription to cancel');
    }

    try {
      // Cancel at period end
      await this.stripe.subscriptions.update(
        user.subscription.stripeSubscriptionId!,
        {
          cancel_at_period_end: true,
        },
      );

      // Update database
      await this.prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      // Send notification
      await this.notificationService.sendNotification(
        userId,
        NotificationType.SUBSCRIPTION_UPDATE,
        {
          title: 'Subscription Cancelled',
          content: 'Your subscription will end at the end of the current billing period',
          metadata: { cancelledAt: new Date() },
        },
      );

      this.logger.log(`Subscription cancelled for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to cancel subscription', error);
      throw new InternalServerErrorException('Failed to cancel subscription');
    }
  }

  /**
   * Create customer portal session
   */
  async createCustomerPortalSession(
    userId: string,
    returnUrl: string,
  ): Promise<string> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Payment system not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user || !user.subscription?.stripeCustomerId) {
      throw new NotFoundException('No billing information found');
    }

    try {
      const session = await this.stripe.billingPortal.sessions.create({
        customer: user.subscription.stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      this.logger.error('Failed to create portal session', error);
      throw new InternalServerErrorException('Failed to create billing portal session');
    }
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(payload: string, signature: string): Promise<void> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Payment system not configured');
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', error);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  /**
   * Get subscription details
   */
  async getSubscriptionDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const currentTier = user.subscriptionTier;
    const subscription = user.subscription;

    return {
      currentTier,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
      } : null,
      pricing: Object.values(PRICING_CONFIG).map(config => ({
        tier: config.tier,
        name: config.name,
        description: config.description,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        features: config.features,
        current: config.tier === currentTier,
      })),
    };
  }

  // Private webhook handlers

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const tier = session.metadata?.tier as SubscriptionTier;

    if (!userId || !tier) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    const subscription = await this.stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    // Create or update subscription record
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        tier,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
      update: {
        tier,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: subscription.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    // Update user tier
    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: tier },
    });

    // Send welcome notification
    await this.notificationService.sendNotification(
      userId,
      NotificationType.SUBSCRIPTION_UPDATE,
      {
        title: 'Welcome to ' + PRICING_CONFIG[tier].name + '!',
        content: 'Your subscription is now active. Enjoy all the features!',
        metadata: { tier },
      },
    );

    this.logger.log(`Subscription activated for user ${userId}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    if (!userId) return;

    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!dbSubscription) return;

    // Update subscription periods
    await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: {
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        status: this.mapStripeStatus(subscription.status),
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const dbSubscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!dbSubscription) return;

    // Update subscription status
    await this.prisma.subscription.update({
      where: { id: dbSubscription.id },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    // Downgrade user to free tier
    await this.prisma.user.update({
      where: { id: dbSubscription.userId },
      data: { subscriptionTier: SubscriptionTier.FREE },
    });

    // Send notification
    await this.notificationService.sendNotification(
      dbSubscription.userId,
      NotificationType.SUBSCRIPTION_UPDATE,
      {
        title: 'Subscription Ended',
        content: 'Your subscription has ended. You have been moved to the Free plan.',
      },
    );

    this.logger.log(`Subscription ended for user ${dbSubscription.userId}`);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeCustomerId: invoice.customer as string },
    });

    if (!subscription) return;

    // Update status
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });

    // Send notification
    await this.notificationService.sendNotification(
      subscription.userId,
      NotificationType.SUBSCRIPTION_UPDATE,
      {
        title: 'Payment Failed',
        content: 'We were unable to process your payment. Please update your payment method.',
        metadata: { invoiceUrl: invoice.hosted_invoice_url },
      },
    );
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.CANCELLED;
    }
  }
}

// ============================================
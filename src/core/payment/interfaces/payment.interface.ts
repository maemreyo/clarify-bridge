// Updated: Payment interfaces and types

import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

export interface PriceConfig {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  features: string[];
}

export const PRICING_CONFIG: Record<SubscriptionTier, PriceConfig> = {
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Perfect for individuals getting started',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      '5 specifications per month',
      '20 AI generations',
      'Basic templates',
      'Community support',
    ],
  },
  [SubscriptionTier.STARTER]: {
    tier: SubscriptionTier.STARTER,
    name: 'Starter',
    description: 'Great for small teams',
    monthlyPrice: 29,
    yearlyPrice: 290,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    features: [
      '50 specifications per month',
      '200 AI generations',
      'Team collaboration (up to 10 members)',
      'Advanced templates',
      'Email support',
      'API access',
    ],
  },
  [SubscriptionTier.PROFESSIONAL]: {
    tier: SubscriptionTier.PROFESSIONAL,
    name: 'Professional',
    description: 'For growing teams and businesses',
    monthlyPrice: 99,
    yearlyPrice: 990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    features: [
      '500 specifications per month',
      '2000 AI generations',
      'Team collaboration (up to 50 members)',
      'Premium templates',
      'Priority support',
      'Advanced analytics',
      'Custom integrations',
    ],
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: -1, // Custom pricing
    yearlyPrice: -1,
    features: [
      'Unlimited specifications',
      'Unlimited AI generations',
      'Unlimited team members',
      'Custom templates',
      'Dedicated support',
      'SLA guarantee',
      'On-premise deployment option',
      'Custom AI models',
    ],
  },
};

export interface CheckoutSessionData {
  userId: string;
  tier: SubscriptionTier;
  interval: 'monthly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionUpdateData {
  tier: SubscriptionTier;
  interval?: 'monthly' | 'yearly';
}

export interface PaymentMethodData {
  paymentMethodId: string;
}

// ============================================
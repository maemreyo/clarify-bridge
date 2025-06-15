// Updated: Payment DTOs

import { IsEnum, IsUrl, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionTier } from '@prisma/client';

export class CreateCheckoutSessionDto {
  @ApiProperty({ enum: SubscriptionTier, example: SubscriptionTier.STARTER })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiProperty({ enum: ['monthly', 'yearly'], example: 'monthly' })
  @IsIn(['monthly', 'yearly'])
  interval: 'monthly' | 'yearly';

  @ApiProperty({ example: 'https://app.claritybridge.com/subscription/success' })
  @IsUrl()
  successUrl: string;

  @ApiProperty({ example: 'https://app.claritybridge.com/subscription/cancel' })
  @IsUrl()
  cancelUrl: string;
}

export class UpdateSubscriptionDto {
  @ApiProperty({ enum: SubscriptionTier })
  @IsEnum(SubscriptionTier)
  tier: SubscriptionTier;

  @ApiPropertyOptional({ enum: ['monthly', 'yearly'] })
  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  interval?: 'monthly' | 'yearly';
}

export class AddPaymentMethodDto {
  @ApiProperty({ description: 'Stripe payment method ID' })
  @IsString()
  paymentMethodId: string;
}

export class CreateCustomerPortalSessionDto {
  @ApiProperty({ example: 'https://app.claritybridge.com/settings/billing' })
  @IsUrl()
  returnUrl: string;
}

export class StripeWebhookDto {
  @ApiProperty()
  @IsString()
  payload: string;

  @ApiProperty()
  @IsString()
  signature: string;
}

// ============================================
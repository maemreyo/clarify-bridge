//  Payment endpoints

import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import {
  CreateCheckoutSessionDto,
  UpdateSubscriptionDto,
  CreateCustomerPortalSessionDto,
} from './dto/payment.dto';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { Public } from '@core/auth/decorators/public.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  async createCheckoutSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    const sessionUrl = await this.paymentService.createCheckoutSession({
      userId,
      ...dto,
    });

    return { url: sessionUrl };
  }

  @Post('subscription/update')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update subscription plan' })
  @ApiResponse({ status: 200, description: 'Subscription updated' })
  async updateSubscription(@CurrentUser('id') userId: string, @Body() dto: UpdateSubscriptionDto) {
    await this.paymentService.updateSubscription(userId, dto);
    return { message: 'Subscription updated successfully' };
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(@CurrentUser('id') userId: string) {
    await this.paymentService.cancelSubscription(userId);
    return { message: 'Subscription will be cancelled at the end of the billing period' };
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe customer portal session' })
  @ApiResponse({ status: 201, description: 'Portal session created' })
  async createPortalSession(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCustomerPortalSessionDto,
  ) {
    const portalUrl = await this.paymentService.createCustomerPortalSession(userId, dto.returnUrl);

    return { url: portalUrl };
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription details' })
  @ApiResponse({ status: 200, description: 'Subscription details retrieved' })
  async getSubscription(@CurrentUser('id') userId: string) {
    return this.paymentService.getSubscriptionDetails(userId);
  }

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(@Body() rawBody: string, @Headers('stripe-signature') signature: string) {
    await this.paymentService.handleWebhookEvent(rawBody, signature);
    return { received: true };
  }
}

export { PaymentController as StripeWebhookController };

// ============================================

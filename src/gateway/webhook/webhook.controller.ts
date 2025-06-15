//  Webhook controller for receiving external events

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
  Req,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '@core/auth/decorators/public.decorator';
import { IntegrationService } from '@application/integration';
import { PaymentService } from '@core/payment';
import { Request } from 'express';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private integrationService: IntegrationService,
    private paymentService: PaymentService,
  ) {}

  @Post('stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Hide from API docs for security
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe signature');
    }

    try {
      const rawBody = req.rawBody;
      if (!rawBody) {
        throw new BadRequestException('Missing raw body');
      }

      await this.paymentService.handleWebhookEvent(rawBody.toString(), signature);

      return { received: true };
    } catch (error) {
      this.logger.error(`Stripe webhook error: ${error.message}`);
      throw new BadRequestException('Webhook processing failed');
    }
  }

  @Post('github')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Handle GitHub webhook events' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async handleGitHubWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    if (!event || !signature) {
      throw new BadRequestException('Missing GitHub headers');
    }

    this.logger.log(`Received GitHub webhook: ${event}`);

    await this.integrationService.processWebhook({
      provider: 'GITHUB' as any,
      event,
      payload,
      secret: signature,
    });
  }

  @Post('jira')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Handle Jira webhook events' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async handleJiraWebhook(
    @Headers('x-atlassian-webhook-identifier') webhookId: string,
    @Body() payload: any,
  ) {
    if (!webhookId) {
      throw new BadRequestException('Invalid Jira webhook');
    }

    const event = payload.webhookEvent || 'unknown';
    this.logger.log(`Received Jira webhook: ${event}`);

    await this.integrationService.processWebhook({
      provider: 'JIRA' as any,
      event,
      payload,
      secret: webhookId,
    });
  }

  @Post('linear')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Handle Linear webhook events' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async handleLinearWebhook(@Headers('linear-signature') signature: string, @Body() payload: any) {
    if (!signature) {
      throw new BadRequestException('Missing Linear signature');
    }

    const event = payload.action || 'unknown';
    this.logger.log(`Received Linear webhook: ${event}`);

    await this.integrationService.processWebhook({
      provider: 'LINEAR' as any,
      event,
      payload,
      secret: signature,
    });
  }

  @Post('slack')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Slack webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleSlackWebhook(
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Body() payload: any,
  ) {
    if (!signature || !timestamp) {
      throw new BadRequestException('Missing Slack headers');
    }

    // Handle URL verification challenge
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    const event = payload.type || 'unknown';
    this.logger.log(`Received Slack webhook: ${event}`);

    await this.integrationService.processWebhook({
      provider: 'SLACK' as any,
      event,
      payload,
      secret: signature,
    });

    return { ok: true };
  }

  @Post('notion')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Handle Notion webhook events' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async handleNotionWebhook(@Headers('notion-signature') signature: string, @Body() payload: any) {
    if (!signature) {
      throw new BadRequestException('Missing Notion signature');
    }

    const event = payload.type || 'unknown';
    this.logger.log(`Received Notion webhook: ${event}`);

    await this.integrationService.processWebhook({
      provider: 'NOTION' as any,
      event,
      payload,
      secret: signature,
    });
  }

  @Post('generic/:provider')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Handle generic webhook events' })
  @ApiResponse({ status: 204, description: 'Webhook processed' })
  async handleGenericWebhook(
    @Param('provider') provider: string,
    @Headers('x-webhook-signature') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log(`Received generic webhook for provider: ${provider}`);

    // For custom/enterprise integrations
    // TODO: Implement generic webhook handling

    return { received: true };
  }
}

// ============================================

import {
  Controller,
  Post,
  Headers,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { WebhookReceiverService, WebhookProcessResult } from '../services/webhook-receiver.service';

@SkipThrottle()
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookReceiverService) {}

  /**
   * Public receiver endpoint for GitHub Webhook events.
   * POST /webhooks/github
   */
  @Post('github')
  @HttpCode(HttpStatus.OK)
  async handleGitHubWebhook(
    @Headers('x-github-delivery') deliveryId: string,
    @Headers('x-github-event') event: string = 'push',
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: any,
    @Req() req: any,
  ): Promise<WebhookProcessResult> {
    const rawPayload = req.rawBody || JSON.stringify(payload);

    return this.webhookService.processGitHubWebhook(
      deliveryId,
      event,
      signature,
      rawPayload,
      payload,
    );
  }
}

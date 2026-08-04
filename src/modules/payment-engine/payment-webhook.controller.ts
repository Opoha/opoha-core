import { Body, Controller, Headers, HttpCode, Param, Post } from '@nestjs/common';

import { PaymentEngine } from './payment-engine.service';
import type { PaymentWebhookResult } from './payment-provider';

/**
 * HTTP ingress for payment provider webhooks.
 * Auth is provider-signature based (validated inside provider.handleWebhook).
 */
@Controller('webhooks/payments')
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentEngine) {}

  @Post(':providerCode')
  @HttpCode(200)
  async handle(
    @Param('providerCode') providerCode: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
  ): Promise<{
    ok: boolean;
    duplicate: boolean;
    result: PaymentWebhookResult;
  }> {
    return this.payments.processWebhook(providerCode, {
      headers,
      body,
    });
  }
}

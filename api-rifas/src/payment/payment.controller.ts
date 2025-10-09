// src/payments/payments.controller.ts
import { BadRequestException, Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  constructor(private readonly svc: PaymentService) {}

  // Front-end llama esto para iniciar el pago
  @Post('payments/:provider/session')
  async createSession(
    @Param('provider') provider: string,
    @Body() body: { orderId: string }
  ) {
    if (!body?.orderId) throw new BadRequestException('orderId requerido');
    return this.svc.createSession(provider, body.orderId);
  }

  // Webhook público del proveedor
  @Post('webhooks/:provider')
  async webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any
  ) {
    return this.svc.handleWebhook(provider, headers, payload);
  }
}

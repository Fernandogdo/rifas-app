import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payment.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}

  @Post(':provider/session')
  async createSession(
    @Param('provider') provider: string,
    @Body() body: { orderId: string },
  ) {
    if (!body?.orderId) throw new BadRequestException('orderId requerido');
    return this.svc.createSession(provider, body.orderId);
  }

  // Tu webhook genérico (lo puedes conservar):
  @Post('webhooks/:provider')
  async webhookGeneric(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    return this.svc.handleWebhook(provider, headers, payload);
  }

  // === Requisito PayPhone: método debe llamarse exactamente NotificacionPago ===
  // URL final que entregarás a PayPhone:  https://.../payments/webhooks/payphone/NotificacionPago
  @Post('webhooks/payphone/NotificacionPago')
  async notificacionPago(
    @Headers() headers: Record<string, string>,
    @Body() payload: any,
  ) {
    try {
      const out = await this.svc.handleWebhook('payphone', headers, payload);
      // PayPhone exige este JSON de respuesta (éxito): { Response:true, ErrorCode:'000' }
      // Doc oficial: Solo notifican transacciones APROBADAS; POST; HTTPS; método NotificacionPago.
      // Y piden exactamente este formato de respuesta.
      // Fuente: docs "Notificación Externa".
      return { Response: true, ErrorCode: '000' };
    } catch (e) {
      // Si decides devolver error (hará que PayPhone reintente):
      return { Response: false, ErrorCode: '222' }; // "error genérico" según catálogo
    }
  }
}

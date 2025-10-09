// src/payments/payments.service.ts
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignService } from 'src/orders/assign.service';
import { EmailService } from 'src/email/email.service';
import { PaymentAdapterRegistry } from './providers/registry';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    private prisma: PrismaService,
    private assign: AssignService,
    private email: EmailService,
    private registry: PaymentAdapterRegistry, // inyectamos un registro de adapters
  ) {}

  async createSession(provider: string, orderId: string) {
    const adapter = this.registry.get(provider); // 'fake' | 'kushki' | 'payphone' | 'datafast'
    const order = await this.prisma.orden.findUnique({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Orden no existe');
    if (order.estado !== 'pendiente') throw new BadRequestException('Orden no está pendiente');

    const session = await adapter.createSession({
      orderId,
      amount: Number(order.total),
      currency: 'USD',
      customerEmail: order.compradorEmail,
    });

    // guarda el intent si te lo da en session (algunos lo devuelven después)
    if (session.paymentIntentId) {
      await this.prisma.orden.update({
        where: { id: orderId },
        data: { paymentIntentId: session.paymentIntentId },
      });
    }

    return session; // típicamente contiene checkoutUrl o credenciales
  }

  async handleWebhook(provider: string, headers: Record<string,string>, payload: any) {
    const adapter = this.registry.get(provider);

    // 1) Verifica firma
    const signatureValid = await adapter.verifyWebhookSignature(headers, payload);
    const paymentIntentId = await adapter.extractPaymentIntentId(payload); // obligatorio
    console.log("🚀 ~ PaymentService ~ handleWebhook ~ paymentIntentId :", paymentIntentId )

    if (!paymentIntentId) throw new BadRequestException('paymentIntentId faltante en webhook');

    // 2) Idempotencia por paymentIntentId (tu tabla WebhookEvent ya la tienes)
    const already = await this.prisma.webhookEvent.findUnique({ where: { paymentIntentId } });
    if (already) return { ok: true, idempotent: true };

    await this.prisma.webhookEvent.create({
      data: {
        provider,
        paymentIntentId,
        signatureValid,
        payload,
        processedAt: new Date(),
      },
    });

    if (!signatureValid) {
      this.logger.warn(`Firma inválida (${provider}) pi=${paymentIntentId}`);
      return { ok: true, signatureValid: false };
    }

    // 3) Localiza orden por paymentIntentId
    const order = await this.prisma.orden.findFirst({ where: { paymentIntentId } });
    console.log("🚀 ~ PaymentService ~ handleWebhook ~ order:", order)
    if (!order) {
      this.logger.warn(`Orden no hallada para pi=${paymentIntentId}`);
      return { ok: true, orderFound: false };
    }

    // 4) (opcional) valida monto
    const amountFromGateway = await adapter.extractAmount(payload);
    if (amountFromGateway != null && Number(order.total) !== Number(amountFromGateway)) {
      await this.prisma.orden.update({ where: { id: order.id }, data: { estado: 'cancelado' } });
      return { ok: true, amountMismatch: true };
    }

    // 5) Marca pagado (si estaba pendiente), manda “payment_confirmed” y asigna
    if (order.estado === 'pendiente') {
      const updated = await this.prisma.orden.update({
        where: { id: order.id },
        data: { estado: 'pagado' },
        include: { rifa: { select: { titulo: true } } },
      });

      await this.email.send('payment_confirmed', order.compradorEmail, {
        rifaTitulo: updated.rifa?.titulo ?? 'Rifa',
        cantidad: order.cantidad,
        total: order.total,
      }, order.id);

      await this.assign.assign(order.id); // usa tu AssignService existente
    }

    return { ok: true };
  }
}

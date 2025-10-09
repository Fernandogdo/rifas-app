// src/payments/providers/fake.adapter.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class FakeAdapter {
  async createSession(input: {
    orderId: string; amount: number; currency: string; customerEmail: string;
  }) {
    const paymentIntentId = `fake_${input.orderId}`; // o un uuid
    return {
      paymentIntentId,
      checkoutUrl: `https://example.local/checkout?pi=${paymentIntentId}`,
    };
  }

  // En dev: acepta todo (no exigimos firmas)
  async verifyWebhookSignature(headers: Record<string,string>, payload: any) {
    return true;
  }

  // Acepta camelCase y snake_case
  async extractPaymentIntentId(payload: any) {
    return payload?.paymentIntentId ?? payload?.payment_intent_id ?? null;
  }

  // Devolver monto si lo mandas en el webhook (opcional)
  async extractAmount(payload: any) {
    return payload?.amount ?? null;
  }

  // Si necesitas: un normalizador completo
  normalizeWebhook(headers: Record<string,string>, payload: any) {
    return {
      type: payload?.type,
      paymentIntentId: payload?.paymentIntentId ?? payload?.payment_intent_id ?? null,
      orderId: payload?.orderId ?? payload?.order_id ?? null,
    };
  }
}

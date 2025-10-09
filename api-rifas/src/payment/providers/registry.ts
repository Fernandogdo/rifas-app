// src/payments/providers/registry.ts
import { Injectable } from '@nestjs/common';
import { FakeAdapter } from './fake.adapter';
// Si implementas otros: import { KushkiAdapter } from './kushki.adapter'; etc.

export interface CreateSessionInput {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
}

export interface CreateSessionResult {
  paymentIntentId?: string;
  checkoutUrl?: string;
  // ...otros campos si el proveedor lo requiere
}

export interface PaymentAdapter {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
  verifyWebhookSignature(headers: Record<string,string>, payload: any): Promise<boolean>;
  extractPaymentIntentId(payload: any): Promise<string | null>;
  extractAmount(payload: any): Promise<number | null>;
}

@Injectable()
export class PaymentAdapterRegistry {
  private readonly adapters: Record<string, PaymentAdapter>;
  constructor(
    private fake: FakeAdapter,
    // inyecta aquí otros adapters cuando los agregues
  ) {
    this.adapters = {
      fake: fake,
      // kushki: kushkiAdapter,
      // payphone: payphoneAdapter,
      // datafast: datafastAdapter,
    };
  }
  get(name: string): PaymentAdapter {
    const a = this.adapters[name];
    if (!a) throw new Error(`Provider adapter no registrado: ${name}`);
    return a;
  }
}

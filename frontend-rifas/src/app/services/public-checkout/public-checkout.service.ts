import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

@Injectable({ providedIn: 'root' })
export class PublicCheckoutService {
  private base = environment.apiBaseUrl.replace(/\/+$/,'');

  constructor(private http: HttpClient) {}

  // Módulo C — crear orden pendiente (asegúrate de tener este endpoint en tu API)
  createPending(body: { rifaId: string; email: string; cantidad: number; })
  : Promise<{ orderId: string; idempotencyKey: string; total: number; }> {
    return firstValueFrom(
      this.http.post<{ orderId: string; idempotencyKey: string; total: number; }>(`${this.base}/checkout`, body)
    );
  }

  // Módulo D — sesión de pago
  createPaymentSession(provider: string, orderId: string): Promise<{ checkoutUrl?: string; paymentIntentId?: string; }> {
    return firstValueFrom(
      this.http.post<{ checkoutUrl?: string; paymentIntentId?: string; }>(`${this.base}/payments/${provider}/session`, { orderId })
    );
  }

  // Módulo G — mis números (solicitar link)
  requestMyNumbersLink(email: string): Promise<{ ok: true }> {
    return firstValueFrom(this.http.post<{ ok: true }>(`${this.base}/mis-numeros/link`, { email }));
  }
}

import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { RealtimeService } from '../../../services/realtime/realtime.service';
import { PublicCheckoutService } from '../../../services/public-checkout/public-checkout.service';
import { PublicRifasService, RifaDetail } from '../../../services/public-rifas/public-rifas.service';

type DocType = 'cedula' | 'ruc' | 'pasaporte';
interface BillingData {
  docType: DocType;
  docNumber: string;
  name: string;        // nombres o razón social
  lastName?: string;   // si no es RUC
  phone?: string;
  address: string;
  province: string;
  city: string;
}

@Component({
  selector: 'app-rifa-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './rifa-detail.component.html',
  styleUrls: ['./rifa-detail.component.css'],
})
export default class RifaDetailComponent implements OnInit, OnDestroy {
  id = signal<string>('');
  loading = signal<boolean>(false);
  error   = signal<string | null>(null);
  rifa    = signal<RifaDetail | null>(null);

  email   = signal<string>('');
  qty     = signal<number>(1);
  busy    = signal<boolean>(false);
  notice  = signal<string | null>(null);

  // Facturación
  requiresInvoice = signal<boolean>(false);
  billing = signal<BillingData>({
    docType: 'cedula',
    docNumber: '',
    name: '',
    lastName: '',
    phone: '',
    address: '',
    province: '',
    city: '',
  });
  billingError = signal<string | null>(null);

  remaining = computed(() => {
    const r = this.rifa();
    if (!r) return 0;
    return Math.max(0, Number(r.stockTotal) - Number(r.stockAsignado));
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: PublicRifasService,
    private checkout: PublicCheckoutService,
    private rt: RealtimeService,
  ) {}

  ngOnInit(): void {
    this.id.set(this.route.snapshot.paramMap.get('id') || '');
    this.load();

    // realtime
    this.rt.subscribe(`rifa:${this.id()}`, (evt) => {
      if (evt?.type === 'stock:update' && evt.rifaId === this.id()) {
        const r = this.rifa();
        if (r) this.rifa.set({
          ...r,
          stockAsignado: Number(evt.stock_asignado ?? evt.stockAsignado ?? r.stockAsignado),
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.rt.unsubscribe(`rifa:${this.id()}`);
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const r = await this.api.getPublic(this.id());
      this.rifa.set({
        ...r,
        precioUnitario: Number(r.precioUnitario ?? 0),
        stockTotal: Number(r.stockTotal ?? 0),
        stockAsignado: Number(r.stockAsignado ?? 0),
      });
    } catch (e: any) {
      this.error.set(e?.message ?? 'Rifa no encontrada');
    } finally {
      this.loading.set(false);
    }
  }

  // helpers UI
  clampInt(val: any, min: number, max: number): number {
    const n = Math.floor(Number(val ?? 0));
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
  pick(n: number) {
    const max = this.remaining();
    if (max <= 0) return;
    this.qty.set(Math.min(Math.max(1, n), max));
  }
  patchBilling(p: Partial<BillingData>) {
    this.billing.set({ ...this.billing(), ...p });
  }

  // Validación simple EC
  validateBilling(): string | null {
    if (!this.requiresInvoice()) return null;
    const b = this.billing();

    if (!b.docType) return 'Selecciona el tipo de documento.';
    if (!b.docNumber?.trim()) return 'Ingresa el número de documento.';
    if (b.docType === 'cedula' && b.docNumber.replace(/\D/g, '').length !== 10) {
      return 'La cédula debe tener 10 dígitos.';
    }
    if (b.docType === 'ruc' && b.docNumber.replace(/\D/g, '').length !== 13) {
      return 'El RUC debe tener 13 dígitos.';
    }
    if (!b.name?.trim()) return b.docType === 'ruc' ? 'Ingresa la razón social.' : 'Ingresa tus nombres.';
    if (b.docType !== 'ruc' && !b.lastName?.trim()) return 'Ingresa tus apellidos.';
    if (!b.address?.trim()) return 'Ingresa la dirección.';
    if (!b.province?.trim()) return 'Ingresa la provincia.';
    if (!b.city?.trim()) return 'Ingresa la ciudad.';
    return null;
  }

  async pagar() {
    const r = this.rifa();
    if (!r) return;

    // Validaciones básicas
    if (this.remaining() <= 0) { this.notice.set('Sin stock disponible.'); return; }
    if (!this.email() || !/^\S+@\S+\.\S+$/.test(this.email())) { this.notice.set('Ingresa un email válido.'); return; }
    if (this.qty() < 1 || this.qty() > this.remaining()) { this.notice.set('Cantidad inválida.'); return; }

    // Facturación (si aplica)
    const billErr = this.validateBilling();
    this.billingError.set(billErr);
    if (billErr) { this.notice.set('Revisa los datos de facturación.'); return; }

    this.busy.set(true);
    this.notice.set(null);

    try {
      // 1) Crear orden pendiente
      const pending = await this.checkout.createPending({
        rifaId: r.id,
        email: this.email().trim(),
        cantidad: this.qty(),
      });

      // 2) Guardar factura localmente (hasta que tengas endpoint)
      try {
        if (this.requiresInvoice()) {
          localStorage.setItem(`billing:${pending.orderId}`, JSON.stringify(this.billing()));
        }
      } catch {}

      console.log('Redirigiendo a PayPhone...', pending.orderId);
      // 3) Iniciar sesión de pago con PayPhone
      const session = await this.checkout.createPaymentSession('payphone', pending.orderId)


      if (session.checkoutUrl) {
        window.location.href = session.checkoutUrl; // redirección a PayPhone
      } else {
        // Fallback local si el adaptador no devuelve URL
        this.router.navigate(['/checkout'], { queryParams: { orderId: pending.orderId } });
      }
    } catch (e: any) {
      this.notice.set(e?.message ?? 'No se pudo iniciar el pago.');
    } finally {
      this.busy.set(false);
    }
  }

  soldPct(): number {
    const r = this.rifa();
    if (!r || !r.stockTotal) return 0;
    return Math.min(100, Math.round((r.stockAsignado / r.stockTotal) * 100));
  }

  img(): string {
    const m = this.rifa()?.media;
    const first = Array.isArray(m) && m.length ? m[0] : null;
    return first?.url || 'https://images.unsplash.com/photo-1511918984145-48de785d4c4f?q=80&w=1200&auto=format&fit=crop';
  }
}

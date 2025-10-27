import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicCheckoutService } from '../../../services/public-checkout/public-checkout.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css'],
})
export default class CheckoutComponent implements OnInit {
  status: 'idle'|'loading'|'error' = 'idle';
  message = 'Preparando tu pago...';

  constructor(private route: ActivatedRoute, private publicCheckoutService: PublicCheckoutService) {}

  async ngOnInit() {
    const orderId = this.route.snapshot.queryParamMap.get('orderId') || '';
    if (!orderId) { this.status = 'error'; this.message = 'Falta orderId.'; return; }

    this.status = 'loading';
    try {
      const session = await this.publicCheckoutService.createPaymentSession('fake', orderId);
      if (session.checkoutUrl) window.location.href = session.checkoutUrl;
      else this.message = 'Listo. Sigue las instrucciones del proveedor.';
    } catch (e: any) {
      this.status = 'error';
      this.message = e?.message ?? 'No se pudo iniciar el pago.';
    }
  }
}

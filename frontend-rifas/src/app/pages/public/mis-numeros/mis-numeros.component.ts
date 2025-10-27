import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PublicCheckoutService } from '../../../services/public-checkout/public-checkout.service';

@Component({
  selector: 'app-mis-numeros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-numeros.component.html',
  styleUrls: ['./mis-numeros.component.css'],
})
export default class MisNumerosComponent {
  email = '';
  loading = false;
  ok = false;
  msg: string | null = null;

  constructor(private checkout: PublicCheckoutService) {}

  async submit() {
    if (!this.email || !/^\S+@\S+\.\S+$/.test(this.email)) { this.msg = 'Email inválido'; return; }
    this.loading = true; this.msg = null;
    try {
      await this.checkout.requestMyNumbersLink(this.email.trim());
      this.ok = true;
    } catch (e: any) {
      this.msg = e?.message ?? 'No se pudo enviar el enlace';
    } finally { this.loading = false; }
  }
}

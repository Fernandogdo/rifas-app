import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-checkout-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout-result.component.html',
  styleUrls: ['./checkout-result.component.css'],
})
export default class CheckoutResultComponent {
  status: 'success'|'failed' = (new URLSearchParams(location.search).get('status') as any) || 'success';
  orderId: string | null = new URLSearchParams(location.search).get('orderId');
}

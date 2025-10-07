import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly svc: CheckoutService) {}

  // idempotencia: Header `Idempotency-Key: <uuid-v4>`
  @Post()
  create(@Body() dto: CreateCheckoutDto, @Headers('idempotency-key') idem?: string) {
    return this.svc.createPending(dto, idem);
  }
}

// src/payments/payments.module.ts
import { Module } from '@nestjs/common';

import { PaymentAdapterRegistry } from './providers/registry';
import { FakeAdapter } from './providers/fake.adapter';
import { OrdersModule } from 'src/orders/orders.module'; // para AssignService + EmailService via OrdersModule imports
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [PrismaModule, EmailModule, OrdersModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentAdapterRegistry, FakeAdapter],
})
export class PaymentModule {}

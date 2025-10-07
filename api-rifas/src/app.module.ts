import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RifasModule } from './rifas/rifas.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrdersModule } from './orders/orders.module';
import { EmailModule } from './email/email.module';
import { MisNumerosModule } from './mis-numeros/mis-numeros.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [AuthModule, PrismaModule, RifasModule, CheckoutModule, OrdersModule, EmailModule, MisNumerosModule, AdminModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

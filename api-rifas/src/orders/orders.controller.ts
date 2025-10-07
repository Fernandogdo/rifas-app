import { Controller, Get, Param, Query, UseGuards, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('admin/ordenes')
  list(
    @Query('estado') estado?: string,
    @Query('rifa') rifa?: string,
    @Query('email') email?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.orders.listAdmin({
      estado: estado as any,
      rifa,
      email,
      page: +page,
      limit: +limit,
    });
  }

  @Get('admin/ordenes/:id')
  get(@Param('id') id: string) {
    return this.orders.getAdmin(id);
  }

  // ====== SOLO DEV: marca la orden como pagada y dispara asignación ======
  @Post('dev/pay/:orderId')
  devPay(@Param('orderId') orderId: string) {
    return this.orders.devMarkPaid(orderId);
  }
}

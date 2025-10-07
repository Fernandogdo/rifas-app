import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignService } from './assign.service';
import { OrdenEstado, Prisma } from '@prisma/client';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private assign: AssignService,
    private email: EmailService,
  ) {}

  async listAdmin(params: { estado?: OrdenEstado; rifa?: string; email?: string; page?: number; limit?: number; }) {
    const page = Math.max(1, params.page ?? 1);
    const take = Math.min(100, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * take;

    const where: Prisma.OrdenWhereInput = {};
    if (params.estado) where.estado = params.estado;
    if (params.rifa) where.rifaId = params.rifa;
    if (params.email) where.compradorEmail = params.email;

    const [items, total] = await Promise.all([
      this.prisma.orden.findMany({
        where,
        select: {
          id:true, rifaId:true, compradorEmail:true,
          cantidad:true, total:true, estado:true, createdAt:true
        },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      this.prisma.orden.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  async getAdmin(id: string) {
    const o = await this.prisma.orden.findUnique({
      where: { id },
      include: { asignaciones: true, rifa: { select: { titulo:true } } },
    });
    if (!o) throw new NotFoundException('Orden no encontrada');
    return o;
  }

  // ====== DEV ONLY ======
  async devMarkPaid(orderId: string) {
    const o = await this.prisma.orden.findUnique({ where: { id: orderId } });
    if (!o) throw new NotFoundException('Orden no encontrada');
    if (o.estado !== 'pendiente') throw new BadRequestException('Solo órdenes pendientes');

    const paymentIntentId = o.paymentIntentId ?? `dev_${orderId}`;
    
    const updated = await this.prisma.orden.update({
    where: { id: orderId },
    data: { estado: 'pagado', paymentIntentId },
    include: { rifa: { select: { titulo:true } } }
  });

     // Enviar "pago confirmado"
    await this.email.send('payment_confirmed', o.compradorEmail, {
      rifaTitulo: updated.rifa?.titulo ?? 'Rifa',
      cantidad: o.cantidad,
      total: o.total,
    }, orderId);

    // En producción esto lo invoca el webhook del proveedor
    await this.assign.assign(orderId);

    return { ok: true };
  }
}

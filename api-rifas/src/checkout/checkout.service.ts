import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';


@Injectable()
export class CheckoutService {
  constructor(
    private prismaService: PrismaService,
  ) {}

  async createPending(dto: CreateCheckoutDto, idemKey?: string) {
    const rifa = await this.prismaService.rifa.findUnique({ where: { id: dto.rifaId } });
    if (!rifa || rifa.estado !== 'publicada') throw new NotFoundException('Rifa no disponible');

    const restante = rifa.stockTotal - rifa.stockAsignado;
    if (dto.cantidad > restante) throw new ConflictException('No hay stock suficiente');

    const idempotencyKey = idemKey || randomUUID();
    // si ya existe orden con ese idempotencyKey (reintento del cliente), devuelve la misma
    const existing = await this.prismaService.orden.findFirst({ where: { idempotencyKey } });
    if (existing) return { orderId: existing.id, idempotencyKey, total: existing.total };

    const email = dto.email.trim();

    const total = new Prisma.Decimal(rifa.precioUnitario).mul(dto.cantidad);

    const order = await this.prismaService.orden.create({
      data: {
        rifaId: rifa.id,
        compradorEmail: email,
        cantidad: dto.cantidad,
        total,
        estado: 'pendiente',
        idempotencyKey,
      },
      select: { id:true, total:true, estado:true, idempotencyKey:true },
    });

    // aquí normalmente iniciarías la sesión de pago con tu proveedor y guardarías paymentIntentId
    return { orderId: order.id, idempotencyKey, total: order.total };
  }
}

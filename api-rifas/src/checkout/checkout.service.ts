// src/checkout/checkout.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CheckoutService {
  constructor(private prisma: PrismaService) {}

  private async generateClientTxId(): Promise<string> {
    // <=15 chars, único. Ej: base36 corto + aleatorio
    for (let i = 0; i < 5; i++) {
      const id = (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 15);
      const exists = await this.prisma.orden.findUnique({ where: { clientTransactionId: id } });
      if (!exists) return id;
    }
    // último recurso
    return randomUUID().replace(/-/g, '').slice(0, 15);
  }

  async createPending(dto: CreateCheckoutDto, idemKey?: string) {
    const rifa = await this.prisma.rifa.findUnique({ where: { id: dto.rifaId } });
    if (!rifa || rifa.estado !== 'publicada') throw new NotFoundException('Rifa no disponible');

    const restante = rifa.stockTotal - rifa.stockAsignado;
    if (dto.cantidad > restante) throw new ConflictException('No hay stock suficiente');

    const idempotencyKey = idemKey || randomUUID();

    // Idempotencia: si ya existe la orden por la misma key, reúsala
    const existing = await this.prisma.orden.findFirst({ where: { idempotencyKey } });
    if (existing) {
      return { orderId: existing.id, idempotencyKey, total: Number(existing.total) };
    }

    const total = new Prisma.Decimal(rifa.precioUnitario).mul(dto.cantidad);
    const clientTransactionId = await this.generateClientTxId();

    const order = await this.prisma.orden.create({
      data: {
        rifaId: rifa.id,
        compradorEmail: dto.email.trim(),
        cantidad: dto.cantidad,
        total,
        estado: 'pendiente',
        idempotencyKey,
        clientTransactionId, // 👈 IMPORTANTE
      },
      select: { id: true, total: true, idempotencyKey: true },
    });

    return { orderId: order.id, idempotencyKey, total: Number(order.total) };
  }
}

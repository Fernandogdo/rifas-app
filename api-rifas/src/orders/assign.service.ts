import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdenEstado } from '@prisma/client';
import { EmailService } from 'src/email/email.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AssignService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService, // lo usarás más adelante
) {}

  async assign(orderId: string) {
    // guardaremos lo necesario para el email fuera de la transacción
    let correoComprador = '';
    let rifaTitulo = '';
    let numerosAsignados: number[] = [];

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.orden.findUnique({
        where: { id: orderId },
        include: { rifa: true },
      });
      if (!order) throw new NotFoundException('Orden no existe');

      // Idempotencia
      if (order.estado === 'asignado') {
        correoComprador = order.compradorEmail;
        rifaTitulo = order.rifa?.titulo ?? 'Rifa';
        // ya asignada previamente: devolvemos OK sin tocar nada
        return;
      }

      if (order.estado !== 'pagado') {
        throw new BadRequestException('La orden debe estar pagada para asignar');
      }

      const rifa = order.rifa;
      if (!rifa) throw new NotFoundException('Rifa no existe');

      const restante = rifa.stockTotal - rifa.stockAsignado;
      if (order.cantidad > restante) {
        throw new BadRequestException('Stock insuficiente para asignar');
      }

      // Asignación pseudoaleatoria:
      // Intentamos hasta X veces por cada número, tolerando colisiones por el unique.
      const asignados: number[] = [];
      for (let i = 0; i < order.cantidad; i++) {
        let success = false;
        let intentos = 0;

        while (!success && intentos < 25) {
          intentos++;
          const numero = 1 + Math.floor(Math.random() * rifa.stockTotal);
          try {
            await tx.asignacion.create({
              data: { ordenId: order.id, rifaId: rifa.id, numero },
            });
            asignados.push(numero);
            success = true;
          } catch (e: any) {
            // P2002 = violation unique(rifaId, numero) -> probamos otro
            if (e?.code !== 'P2002') throw e;
          }
        }

        if (!success) {
          // abortamos toda la transacción para no dejar estados a medias
          throw new BadRequestException(
            'No fue posible asignar números únicos, reintente',
          );
        }
      }

      // Actualizar stock y estado de orden
      await tx.rifa.update({
        where: { id: rifa.id },
        data: { stockAsignado: { increment: order.cantidad } },
      });

      await tx.orden.update({
        where: { id: order.id },
        data: { estado: 'asignado' as OrdenEstado },
      });

      // datos para el email luego del commit
      correoComprador = order.compradorEmail;
      rifaTitulo = rifa.titulo;
      numerosAsignados = asignados;
    });

    // === fuera de la transacción ===
    // Enviar correo con los números (si por alguna razón falla el SMTP, no afecta al commit)
    if (correoComprador && numerosAsignados.length > 0) {
      await this.emailService.send(
        'numbers_assigned',
        correoComprador,
        { rifaTitulo, numeros: numerosAsignados },
        orderId,
      );
    }

    return { ok: true, count: numerosAsignados.length, numeros: numerosAsignados.sort((a,b)=>a-b) };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class RateLimitService {
  constructor(private prisma: PrismaService) {}

  private hash(s: string) {
    return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
  }

  /**
   * Chequea y consume 1 del cupo de la ventana.
   * - prefix: nombre lógico del bucket (p.ej. 'mis-numeros:email' o 'auth:forgot')
   * - identRaw: identificador (email, ip, etc.)
   * - limit: máximo permitido dentro de la ventana
   * - windowSec: segundos de la ventana (3600 = 1 hora)
   *
   * Retorna true si PERMITIDO, false si bloqueado.
   */
  async checkAndConsume(prefix: string, identRaw: string, limit: number, windowSec: number): Promise<boolean> {
    const ident = this.hash((identRaw || '').trim().toLowerCase());
    const key = `${prefix}:${ident}`;
    const now = new Date();
    const newWindowEnd = new Date(now.getTime() + windowSec * 1000);

    return this.prisma.$transaction(async (tx) => {
      const rec = await tx.rateLimit.findUnique({ where: { key } });

      // No existe → crearlo con count=1
      if (!rec) {
        await tx.rateLimit.create({ data: { key, count: 1, windowEnd: newWindowEnd } });
        return true;
      }

      // Ventana expirada → reset a 1
      if (rec.windowEnd <= now) {
        await tx.rateLimit.update({
          where: { key },
          data: { count: 1, windowEnd: newWindowEnd },
        });
        return true;
      }

      // Dentro de la ventana actual
      if (rec.count >= limit) {
        return false; // BLOQUEAR
      }

      await tx.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      return true;
    });
  }
}

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/email/email.service';
import * as crypto from 'crypto';

@Injectable()
export class MisNumerosService {
  constructor(private prisma: PrismaService, private email: EmailService) {}

  async sendLink(email: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000*60*30); // 30 min

    await this.prisma.misNumerosToken.create({ data: { email, token, expiresAt: expires } });

    // envía link (puedes usar plantilla 'order_pending' o crear otra)
    const url = `${process.env.BASE_URL}/mis-numeros?token=${token}`;
    console.log("🚀 ~ MisNumerosService ~ sendLink ~ url:", url)
    await this.email.send('mis_numeros_link', email, {
      url: `${process.env.BASE_URL}/mis-numeros?token=${token}`,
      minutos: 30,
    });

  }

  async getByToken(token: string) {
    const row = await this.prisma.misNumerosToken.findUnique({ where: { token } });
    if (!row || row.used || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // junta órdenes + asignaciones
    const ordenes = await this.prisma.orden.findMany({
      where: { compradorEmail: row.email, estado: { in: ['pagado','asignado'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, createdAt: true, cantidad: true,
        asignaciones: { select: { numero: true } },
        rifa: { select: { titulo: true } },
      },
    });

    // marca el token como usado (opcional si es one-shot)
    await this.prisma.misNumerosToken.update({ where: { token }, data: { used: true } });

    return {
      email: row.email,
      ordenes: ordenes.map(o => ({
        id: o.id,
        fecha: o.createdAt,
        rifaTitulo: o.rifa.titulo,
        cantidad: o.cantidad,
        numeros: o.asignaciones.map(a => a.numero).sort((a,b)=>a-b),
      })),
    };
  }
}

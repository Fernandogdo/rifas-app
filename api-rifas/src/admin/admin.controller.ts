import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard(@Query('limit') limit = '10') {
    const ultimas = await this.prisma.orden.findMany({
      orderBy: { createdAt: 'desc' },
      take: +limit,
      select: {
        id: true,
        compradorEmail: true,
        total: true,
        estado: true,
        createdAt: true,
        rifa: { select: { titulo: true } },
      },
    });

    const rifas = await this.prisma.rifa.findMany({
      select: { id:true, titulo:true, stockTotal:true, stockAsignado:true, precioUnitario:true }
    });

    const ventasTotales = await this.prisma.orden.aggregate({
      _sum: { total: true },
      where: { estado: { in: ['pagado', 'asignado'] } },
    });

    return {
      ventasMonto: ventasTotales._sum.total ?? 0,
      rifas: rifas.map(r => ({
        id: r.id,
        titulo: r.titulo,
        porcentajeVendido: r.stockTotal ? (r.stockAsignado / r.stockTotal) : 0,
        restantes: r.stockTotal - r.stockAsignado,
      })),
      ultimasOrdenes: ultimas,
    };
  }
}

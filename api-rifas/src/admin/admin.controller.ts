import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
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
    // últimas órdenes
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

    // rifas y % vendido
    const rifas = await this.prisma.rifa.findMany({
      select: { id: true, titulo: true, stockTotal: true, stockAsignado: true },
    });

    // ventas globales (solo pagado/asignado)
    const aggPagadas = await this.prisma.orden.aggregate({
      _sum: { total: true, cantidad: true },
      where: { estado: { in: ['pagado', 'asignado'] } },
    });

    // pendientes (para “qué tan cerca de cobrar”)
    const aggPend = await this.prisma.orden.aggregate({
      _sum: { cantidad: true },
      where: { estado: 'pendiente' },
    });

    return {
      ventasMonto: Number(aggPagadas._sum.total ?? 0),
      ticketsVendidos: Number(aggPagadas._sum.cantidad ?? 0),
      ticketsPendientes: Number(aggPend._sum.cantidad ?? 0),
      rifasActivas: rifas.length,
      rifas: rifas.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        porcentajeVendido: r.stockTotal ? r.stockAsignado / r.stockTotal : 0,
        restantes: r.stockTotal - r.stockAsignado,
      })),
      ultimasOrdenes: ultimas,
    };
  }

  @Get('dashboard/rifas/:id')
  async dashboardRifa(
    @Param('id') rifaId: string,
    @Query('limitOrdenes') limitOrdenes = '10',
    @Query('days') days = '30',
  ) {
    // 1) Meta de la rifa
    const rifa = await this.prisma.rifa.findUnique({
      where: { id: rifaId },
      select: {
        id: true,
        titulo: true,
        precioUnitario: true,
        stockTotal: true,
        stockAsignado: true,
        estado: true,
      },
    });
    if (!rifa) return { error: 'Rifa no encontrada' };

    // 2) Agregados por estado de orden
    const byEstado = await this.prisma.orden.groupBy({
      by: ['estado'],
      where: { rifaId },
      _count: { _all: true },
      _sum: { cantidad: true, total: true },
    });

    const mapEstado = (
      estado: 'pendiente' | 'pagado' | 'asignado' | 'cancelado',
    ) => {
      const row = byEstado.find((x) => x.estado === estado);
      return {
        estado,
        ordenes: row?._count?._all ?? 0,
        tickets: Number(row?._sum?.cantidad ?? 0),
        monto: Number(row?._sum?.total ?? 0),
      };
    };

    // 3) Contadores rápidos
    const vendidos = rifa.stockAsignado; // asumiendo que stockAsignado es verdad de terreno
    const pendientes = mapEstado('pendiente').tickets;

    // 4) Top compradores (solo pagado/asignado)
    const top = await this.prisma.orden.groupBy({
      by: ['compradorEmail'],
      where: { rifaId, estado: { in: ['pagado', 'asignado'] } },
      _count: { _all: true },
      _sum: { cantidad: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 5,
    });

    // 5) Serie diaria últimos N días (SQL crudo para date_trunc)
    const serie = await this.prisma.$queryRaw<
      { fecha: Date; monto: number; tickets: number }[]
    >`
    SELECT
      date_trunc('day', "createdAt") AS fecha,
      COALESCE(SUM("total")::numeric,0) AS monto,
      COALESCE(SUM("cantidad"),0) AS tickets
    FROM "Orden"
    WHERE "rifaId" = ${rifaId}
      AND "estado" IN ('pagado','asignado')
      AND "createdAt" >= now() - (${Number(days)} || ' days')::interval
    GROUP BY 1
    ORDER BY 1
  `;

    // 6) Últimas órdenes de esa rifa
    const ultimas = await this.prisma.orden.findMany({
      where: { rifaId },
      orderBy: { createdAt: 'desc' },
      take: +limitOrdenes,
      select: {
        id: true,
        compradorEmail: true,
        total: true,
        estado: true,
        createdAt: true,
      },
    });

    const estados = [
      mapEstado('pendiente'),
      mapEstado('pagado'),
      mapEstado('asignado'),
      mapEstado('cancelado'),
    ];
    const ventasMonto = estados
      .filter((e) => e.estado !== 'pendiente' && e.estado !== 'cancelado')
      .reduce((a, e) => a + e.monto, 0);

    return {
      rifa,
      counters: {
        ticketsVendidos: vendidos,
        ticketsPendientes: pendientes,
        ventasMonto,
        porcentajeVendido: rifa.stockTotal
          ? rifa.stockAsignado / rifa.stockTotal
          : 0,
        restantes: rifa.stockTotal - rifa.stockAsignado,
      },
      estados,
      topCompradores: top.map((t) => ({
        email: t.compradorEmail,
        ordenes: t._count?._all ?? 0,
        tickets: Number(t._sum?.cantidad ?? 0),
        monto: Number(t._sum?.total ?? 0),
      })),
      serieDiaria: serie.map((r) => ({
        fecha: r.fecha,
        monto: Number(r.monto ?? 0),
        tickets: Number(r.tickets ?? 0),
      })),
      ultimasOrdenes: ultimas,
    };
  }
}

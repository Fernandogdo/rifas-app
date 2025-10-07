import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRifaDto } from './dto/create-rifa.dto';
import { UpdateRifaDto } from './dto/update-rifa.dto';
import { RifaEstado } from '@prisma/client';

@Injectable()
export class RifasService {
  constructor(private prismaService: PrismaService) {}

  async listPublic(opts: { estado: string, page: number, limit: number }) {
    const estado = opts.estado as RifaEstado;
    const page = Math.max(1, opts.page || 1);
    const take = Math.min(50, Math.max(1, opts.limit || 12));
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prismaService.rifa.findMany({
        where: { estado },
        select: {
          id: true, titulo: true, precioUnitario: true,
          stockTotal: true, stockAsignado: true, media: true,
        },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      this.prismaService.rifa.count({ where: { estado } }),
    ]);
    return { items, total, page, limit: take };
  }

  async getPublic(id: string) {
    const r = await this.prismaService.rifa.findFirst({
      where: { id, estado: { in: ['publicada','agotada','cerrada'] } },
      select: { id:true, titulo:true, descripcion:true, precioUnitario:true,
        stockTotal:true, stockAsignado:true, media:true, estado:true },
    });
    if (!r) throw new NotFoundException('Rifa no encontrada');
    return r;
  }

  async create(dto: CreateRifaDto) {
    if (dto.precioUnitario <= 0) throw new BadRequestException('Precio inválido');
    if (dto.stockTotal <= 0) throw new BadRequestException('Stock inválido');

    return this.prismaService.rifa.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        precioUnitario: dto.precioUnitario,
        stockTotal: dto.stockTotal,
        estado: dto.estado ?? 'borrador',
        media: dto.media ?? [],
      },
    });
  }

  async update(id: string, dto: UpdateRifaDto) {
    // regla: no reducir stockTotal por debajo de stockAsignado
    if (dto.stockTotal !== undefined) {
      const r = await this.prismaService.rifa.findUnique({ where: { id } });
      if (!r) throw new NotFoundException();
      if (dto.stockTotal < r.stockAsignado) {
        throw new BadRequestException('stockTotal no puede ser menor a stockAsignado');
      }
    }
    return this.prismaService.rifa.update({ where: { id }, data: dto });
  }

  async cambiarEstado(id: string, estado: RifaEstado) {
    const r = await this.prismaService.rifa.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    // simple: si no hay stock restante, puedes marcar agotada automáticamente
    return this.prismaService.rifa.update({ where: { id }, data: { estado } });
  }
}

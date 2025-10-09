import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRifaDto } from './dto/create-rifa.dto';
import { UpdateRifaDto } from './dto/update-rifa.dto';
import { RifaEstado } from '@prisma/client';
import { AuditoriaService } from 'src/auditoria/auditoria.service';


@Injectable()
export class RifasService {
  constructor(
    private prismaService: PrismaService,
    private auditoriaService: AuditoriaService,
  ) {}

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

  async create(dto: CreateRifaDto, usuarioId: string) {
    if (dto.precioUnitario <= 0) throw new BadRequestException('Precio inválido');
    if (dto.stockTotal <= 0) throw new BadRequestException('Stock inválido');

    const rifa = await this.prismaService.rifa.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        precioUnitario: dto.precioUnitario,
        stockTotal: dto.stockTotal,
        estado: dto.estado ?? 'borrador',
        media: dto.media ?? [],
      },
    });

    await this.auditoriaService.log({
      entidad: 'Rifa',
      entidadId: rifa.id,
      accion: 'create',
      payload: { by: usuarioId, dto },
    });

    return rifa;
  }


  async update(id: string, dto: UpdateRifaDto, usuarioId: string) {
    if (dto.stockTotal !== undefined) {
      const r = await this.prismaService.rifa.findUnique({ where: { id } });
      if (!r) throw new NotFoundException();
      if (dto.stockTotal < r.stockAsignado) {
        throw new BadRequestException('stockTotal no puede ser menor a stockAsignado');
      }
    }

    const before = await this.prismaService.rifa.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();

    const after = await this.prismaService.rifa.update({ where: { id }, data: dto });

    await this.auditoriaService.log({
      entidad: 'Rifa',
      entidadId: id,
      accion: 'update',
      payload: { by: usuarioId, before: this.pickRifaAuditFields(before), after: this.pickRifaAuditFields(after) },
    });

    return after;
  }

  pickRifaAuditFields(x: any) {
    return {
      titulo: x.titulo,
      precioUnitario: x.precioUnitario,
      stockTotal: x.stockTotal,
      stockAsignado: x.stockAsignado,
      estado: x.estado,
    };
  }

  

  async cambiarEstado(id: string, estado: RifaEstado, usuarioId: string) {
    const r = await this.prismaService.rifa.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();

    const updated = await this.prismaService.rifa.update({ where: { id }, data: { estado } });

    await this.auditoriaService.log({
      entidad: 'Rifa',
      entidadId: id,
      accion: 'state_change',
      payload: { by: usuarioId, from: r.estado, to: estado },
    });

    return updated;
  }

  
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRifaDto } from './dto/create-rifa.dto';
import { UpdateRifaDto } from './dto/update-rifa.dto';
import { Prisma, RifaEstado } from '@prisma/client';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Injectable()
export class RifasService {
  constructor(
    private prismaService: PrismaService,
    private auditoriaService: AuditoriaService,
  ) {}

  // ------------------- PÚBLICO -------------------
  async listPublic(opts: { estado: string; page: number; limit: number }) {
    const estado = opts.estado as RifaEstado;
    const page = Math.max(1, opts.page || 1);
    const take = Math.min(50, Math.max(1, opts.limit || 12));
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prismaService.rifa.findMany({
        where: { estado },
        select: {
          id: true,
          titulo: true,
          precioUnitario: true,
          stockTotal: true,
          stockAsignado: true,
          media: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prismaService.rifa.count({ where: { estado } }),
    ]);
    return { items, total, page, limit: take };
  }

  async getPublic(id: string) {
    const r = await this.prismaService.rifa.findFirst({
      where: { id, estado: { in: ['publicada', 'agotada', 'cerrada'] } },
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        precioUnitario: true,
        stockTotal: true,
        stockAsignado: true,
        media: true,
        estado: true,
      },
    });
    if (!r) throw new NotFoundException('Rifa no encontrada');
    return r;
  }

  // ------------------- ADMIN: LIST -------------------
  async listAdmin(args: {
    search?: string;
    estado?: 'borrador' | 'publicada' | 'agotada' | 'cerrada';
    page: number;
    limit: number;
    // El frontend manda 'created_at:desc' (snake); mapeamos aquí a camelCase de Prisma
    sort?: string;
  }) {
    const page = Math.max(1, args.page || 1);
    const take = Math.min(100, Math.max(1, args.limit || 10));
    const skip = (page - 1) * take;

    const orderBy = this.parseSort(args.sort);

    const where: Prisma.RifaWhereInput = {};
    if (args.estado) where.estado = args.estado as any;

    if (args.search && args.search.trim()) {
      where.OR = [
        { titulo: { contains: args.search, mode: 'insensitive' } },
        { descripcion: { contains: args.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.rifa.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          titulo: true,
          descripcion: true,
          precioUnitario: true,
          stockTotal: true,
          stockAsignado: true,
          estado: true,
          media: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prismaService.rifa.count({ where }),
    ]);

    return { items, total, page, limit: take };
  }

  // Mapea 'created_at:desc' → { createdAt: 'desc' } (acepta varios campos)
  private parseSort(sort?: string): Prisma.RifaOrderByWithRelationInput {
    const def: Prisma.RifaOrderByWithRelationInput = { createdAt: 'desc' };

    if (!sort || typeof sort !== 'string') return def;

    const [rawField, rawDir] = sort.split(':');
    const dir = (rawDir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Normaliza snake_case a camelCase de Prisma
    const fieldMap: Record<string, keyof Prisma.RifaOrderByWithRelationInput> = {
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      precio_unitario: 'precioUnitario',
      stock_total: 'stockTotal',
      stock_asignado: 'stockAsignado',
      titulo: 'titulo',
      estado: 'estado',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      precioUnitario: 'precioUnitario',
      stockTotal: 'stockTotal',
      stockAsignado: 'stockAsignado',
    };

    const key = fieldMap[rawField as keyof typeof fieldMap];
    if (!key) return def;

    return { [key]: dir } as Prisma.RifaOrderByWithRelationInput;
  }

  // ------------------- ADMIN: GET ONE -------------------
  async getAdmin(id: string) {
    const r = await this.prismaService.rifa.findUnique({
      where: { id },
    });
    if (!r) throw new NotFoundException('Rifa no encontrada');
    return r;
  }

  // ------------------- ADMIN: CREATE/UPDATE/DELETE -------------------
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
      payload: {
        by: usuarioId,
        before: this.pickRifaAuditFields(before),
        after: this.pickRifaAuditFields(after),
      },
    });

    return after;
  }

  async remove(id: string, usuarioId: string) {
    const exists = await this.prismaService.rifa.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Rifa no encontrada');

    await this.prismaService.rifa.delete({ where: { id } });

    await this.auditoriaService.log({
      entidad: 'Rifa',
      entidadId: id,
      accion: 'delete',
      payload: { by: usuarioId },
    });

    return { ok: true };
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

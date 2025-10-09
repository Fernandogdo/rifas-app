// src/auditoria/auditoria.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuditoriaService {
  constructor(private prisma: PrismaService) {}

  async log(opts: {
    entidad: string;          // 'Rifa' | 'Orden' | 'EmailTemplate' | ...
    entidadId?: string | null;
    accion: string;           // 'create' | 'update' | 'delete' | 'publish' | ...
    payload?: any;            // {antes, despues, diff} o lo que necesites
  }) {
    const { entidad, entidadId = null, accion, payload = null } = opts;
    return this.prisma.auditoria.create({
      data: { entidad, entidadId, accion, payload },
    });
  }
}

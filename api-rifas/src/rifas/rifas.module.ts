import { Module } from '@nestjs/common';
import { RifasService } from './rifas.service';
import { RifasController } from './rifas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuditoriaService } from 'src/auditoria/auditoria.service';

@Module({
  imports: [PrismaModule],
  controllers: [RifasController],
  providers: [RifasService, AuditoriaService],
  exports: [RifasService],
})
export class RifasModule {}

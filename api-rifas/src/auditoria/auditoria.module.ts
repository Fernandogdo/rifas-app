import { Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports : [PrismaModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService],
})
export class AuditoriaModule {}

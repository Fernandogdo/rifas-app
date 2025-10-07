import { Module } from '@nestjs/common';
import { RifasService } from './rifas.service';
import { RifasController } from './rifas.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RifasController],
  providers: [RifasService],
  exports: [RifasService],
})
export class RifasModule {}

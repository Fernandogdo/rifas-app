import { Module } from '@nestjs/common';
import { MisNumerosController } from './mis-numeros.controller';
import { MisNumerosService } from './mis-numeros.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [PrismaModule, EmailModule, CommonModule],
  controllers: [MisNumerosController],
  providers: [MisNumerosService],
})
export class MisNumerosModule {}

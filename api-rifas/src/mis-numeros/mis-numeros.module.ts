import { Module } from '@nestjs/common';
import { MisNumerosController } from './mis-numeros.controller';
import { MisNumerosService } from './mis-numeros.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [MisNumerosController],
  providers: [MisNumerosService],
})
export class MisNumerosModule {}

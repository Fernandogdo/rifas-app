// src/mis-numeros/mis-numeros.controller.ts
import {
  Body,Controller, Get, Post, Query, Req, HttpException, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { MisNumerosLinkDto } from './dto/create-mis-numero.dto';
import { MisNumerosService } from './mis-numeros.service';
import { RateLimitService } from 'src/common/ratelimit/ratelimit.service';
@Controller()
export class MisNumerosController {
  constructor(
    private readonly misNumerosService: MisNumerosService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /**
   * Público: solicita link seguro por email.
   * Límite: 3 por hora por email. (Opcional: por IP también)
   */
  @Post('mis-numeros/link')
  async link(@Body() dto: MisNumerosLinkDto, @Req() req: any) {
    const email = (dto?.email || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('email requerido');

    // 1) Rate limit por EMAIL (3/h)
    const okEmail = await this.rateLimit.checkAndConsume(
      'mis-numeros:email',
      email,
      3,
      3600,
    );
   if (!okEmail) {
  throw new HttpException(
    'Has alcanzado el límite de solicitudes. Intenta nuevamente más tarde.', HttpStatus.TOO_MANY_REQUESTS,
  );
}

    // 2) (Opcional) Rate limit por IP (10/h)
    // const ip = (req?.headers?.['x-forwarded-for'] ?? req?.ip ?? '').toString();
    // const okIp = await this.rateLimit.checkAndConsume('mis-numeros:ip', ip, 10, 3600);
    // if (!okIp) {
    //   throw new TooManyRequestsException('Límite por IP alcanzado. Intenta más tarde.');
    // }

    await this.misNumerosService.sendLink(email);
    // 202 Accepted semánticamente es apropiado, pero como devolvemos JSON simple, 200 está OK.
    return { accepted: true };
  }

  /**
   * Público: obtiene órdenes/números con token firmado.
   */
  @Get('mis-numeros')
  async get(@Query('token') token: string) {
    return this.misNumerosService.getByToken(token);
  }
}

import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { MisNumerosLinkDto } from './dto/create-mis-numero.dto';
import { MisNumerosService } from './mis-numeros.service';

@Controller()
export class MisNumerosController {
  constructor(private misNumerosService: MisNumerosService) {}

  @Post('mis-numeros/link') // público con rate limit (luego)
  async link(@Body() dto: MisNumerosLinkDto) {
    await this.misNumerosService.sendLink(dto.email);
    return { accepted: true };
  }

  @Get('mis-numeros') // público con verificación de token
  async get(@Query('token') token: string) {
    return this.misNumerosService.getByToken(token);
  }
}

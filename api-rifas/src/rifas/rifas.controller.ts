import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RifasService } from './rifas.service';
import { CreateRifaDto } from './dto/create-rifa.dto';
import { UpdateRifaDto } from './dto/update-rifa.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller()
export class RifasController {
  constructor(private readonly rifas: RifasService) {}

  // --- público: catálogo y detalle ---
  @Get('rifas')
  listPublic(
    @Query('estado') estado = 'publicada',
    @Query('page') page = '1',
    @Query('limit') limit = '12',
  ) {
    return this.rifas.listPublic({ estado, page: +page, limit: +limit });
  }

  @Get('rifas/:id')
  getPublic(@Param('id') id: string) {
    return this.rifas.getPublic(id);
  }

  // --- admin ---
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/rifas')
  create(@Body() dto: CreateRifaDto) {
    return this.rifas.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/rifas/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRifaDto) {
    return this.rifas.update(id, dto);
  }

  // publicar/cerrar
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/rifas/:id/publicar')
  publicar(@Param('id') id: string) {
    return this.rifas.cambiarEstado(id, 'publicada');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/rifas/:id/cerrar')
  cerrar(@Param('id') id: string) {
    return this.rifas.cambiarEstado(id, 'cerrada');
  }
}

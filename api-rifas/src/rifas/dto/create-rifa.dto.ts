import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { RifaEstado } from '@prisma/client';

export class CreateRifaDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  titulo!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsPositive()
  @Transform(({ value }) => Number(value))
  precioUnitario!: number;

  @IsInt()
  @Min(1)
  @Transform(({ value }) => Number(value))
  stockTotal!: number;

  @IsOptional()
  @IsEnum(RifaEstado)
  estado?: RifaEstado;

  @IsOptional()
  media?: Array<Record<string, any>>;
}

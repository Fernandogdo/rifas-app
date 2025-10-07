import { IsEmail, IsEnum, IsOptional, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { Rol } from '@prisma/client';

export class UserDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value).trim())
  nombreUnido: string;

  @IsOptional()
  @IsEnum(Rol)
  rol?: Rol; // default en el servicio si no llega
}

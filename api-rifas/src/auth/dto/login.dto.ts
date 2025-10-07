import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @IsEmail()
  @Transform(({ value }) => String(value).trim())
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

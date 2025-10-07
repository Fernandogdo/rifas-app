import { IsEmail, IsInt, IsString, Min, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCheckoutDto {
  @IsUUID() rifaId: string;

  @IsEmail()
  @Transform(({value}) => String(value).trim())
  email: string;

  @IsInt() @Min(1)
  cantidad: number;
}

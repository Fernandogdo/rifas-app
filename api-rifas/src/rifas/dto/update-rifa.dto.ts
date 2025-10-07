import { PartialType } from '@nestjs/mapped-types';
import { CreateRifaDto } from './create-rifa.dto';

export class UpdateRifaDto extends PartialType(CreateRifaDto) {}

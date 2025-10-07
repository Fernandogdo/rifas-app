import { PartialType } from '@nestjs/mapped-types';
import { MisNumerosLinkDto } from './create-mis-numero.dto';

export class UpdateMisNumeroDto extends PartialType(MisNumerosLinkDto) {}

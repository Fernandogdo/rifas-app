import { PartialType } from '@nestjs/mapped-types';
import { CreateRatelimitDto } from './create-ratelimit.dto';

export class UpdateRatelimitDto extends PartialType(CreateRatelimitDto) {}

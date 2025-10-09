import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CreateRatelimitDto } from './dto/create-ratelimit.dto';
import { UpdateRatelimitDto } from './dto/update-ratelimit.dto';
import { RateLimitService } from './ratelimit.service';

@Controller('ratelimit')
export class RatelimitController {
  constructor(private readonly ratelimitService: RateLimitService) {}

  // @Post()
  // create(@Body() createRatelimitDto: CreateRatelimitDto) {
  //   return this.ratelimitService.create(createRatelimitDto);
  // }

  // @Get()
  // findAll() {
  //   return this.ratelimitService.findAll();
  // }

  // @Get(':id')
  // findOne(@Param('id') id: string) {
  //   return this.ratelimitService.findOne(+id);
  // }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() updateRatelimitDto: UpdateRatelimitDto) {
  //   return this.ratelimitService.update(+id, updateRatelimitDto);
  // }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.ratelimitService.remove(+id);
  // }
}

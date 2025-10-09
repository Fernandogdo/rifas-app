import { Module } from '@nestjs/common';
import { RatelimitController } from './ratelimit.controller';
import { RateLimitService } from './ratelimit.service';

@Module({
  controllers: [RatelimitController],
  providers: [RateLimitService],
})
export class RatelimitModule {}

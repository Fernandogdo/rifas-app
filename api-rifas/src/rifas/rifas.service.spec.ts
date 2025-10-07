import { Test, TestingModule } from '@nestjs/testing';
import { RifasService } from './rifas.service';

describe('RifasService', () => {
  let service: RifasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RifasService],
    }).compile();

    service = module.get<RifasService>(RifasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

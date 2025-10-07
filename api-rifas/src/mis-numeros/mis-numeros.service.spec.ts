import { Test, TestingModule } from '@nestjs/testing';
import { MisNumerosService } from './mis-numeros.service';

describe('MisNumerosService', () => {
  let service: MisNumerosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MisNumerosService],
    }).compile();

    service = module.get<MisNumerosService>(MisNumerosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

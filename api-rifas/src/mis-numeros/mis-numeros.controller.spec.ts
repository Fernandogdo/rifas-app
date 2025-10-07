import { Test, TestingModule } from '@nestjs/testing';
import { MisNumerosController } from './mis-numeros.controller';
import { MisNumerosService } from './mis-numeros.service';

describe('MisNumerosController', () => {
  let controller: MisNumerosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MisNumerosController],
      providers: [MisNumerosService],
    }).compile();

    controller = module.get<MisNumerosController>(MisNumerosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

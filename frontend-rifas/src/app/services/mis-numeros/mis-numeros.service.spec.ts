import { TestBed } from '@angular/core/testing';

import { MisNumerosService } from './mis-numeros.service';

describe('MisNumerosService', () => {
  let service: MisNumerosService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MisNumerosService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

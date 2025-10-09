import { TestBed } from '@angular/core/testing';

import { RifasService } from './rifas.service';

describe('RifasService', () => {
  let service: RifasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RifasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

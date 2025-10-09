import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MisNumeros } from './mis-numeros';

describe('MisNumeros', () => {
  let component: MisNumeros;
  let fixture: ComponentFixture<MisNumeros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisNumeros]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MisNumeros);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

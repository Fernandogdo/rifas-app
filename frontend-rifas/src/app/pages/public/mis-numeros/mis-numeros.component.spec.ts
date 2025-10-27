import { ComponentFixture, TestBed } from '@angular/core/testing';

import  MisNumerosComponent  from './mis-numeros.component';

describe('MisNumerosComponent', () => {
  let component: MisNumerosComponent;
  let fixture: ComponentFixture<MisNumerosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisNumerosComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MisNumerosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

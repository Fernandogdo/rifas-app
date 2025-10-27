import { ComponentFixture, TestBed } from '@angular/core/testing';

import CheckoutResultComponent  from './checkout-result.component';

describe('CheckoutResultComponent', () => {
  let component: CheckoutResultComponent;
  let fixture: ComponentFixture<CheckoutResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutResultComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CheckoutResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RifasComponent } from './rifas.component';

describe('RifasComponent', () => {
  let component: RifasComponent;
  let fixture: ComponentFixture<RifasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RifasComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RifasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

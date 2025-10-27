import { ComponentFixture, TestBed } from '@angular/core/testing';

import RifaDetailComponent  from './rifa-detail.component';

describe('RifaDetail', () => {
  let component: RifaDetailComponent;
  let fixture: ComponentFixture<RifaDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RifaDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RifaDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

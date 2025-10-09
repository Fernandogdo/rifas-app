import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RifaDetail } from './rifa-detail.component';

describe('RifaDetail', () => {
  let component: RifaDetail;
  let fixture: ComponentFixture<RifaDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RifaDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RifaDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

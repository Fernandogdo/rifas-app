import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RifasListComponent } from './rifas-list.component';



describe('RifasListComponent', () => {
  let component: RifasListComponent;
  let fixture: ComponentFixture<RifasListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RifasListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RifasListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

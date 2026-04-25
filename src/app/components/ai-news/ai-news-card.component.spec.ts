import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiNewsCardComponent } from './ai-news-card.component';

describe('AiNewsCardComponent', () => {
  let component: AiNewsCardComponent;
  let fixture: ComponentFixture<AiNewsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiNewsCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AiNewsCardComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have item signal', () => {
    expect(component.item).toBeDefined();
    expect(typeof component.item).toBe('function');
  });
});
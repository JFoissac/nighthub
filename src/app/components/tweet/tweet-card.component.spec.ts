import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TweetCardComponent } from './tweet-card.component';

describe('TweetCardComponent', () => {
  let component: TweetCardComponent;
  let fixture: ComponentFixture<TweetCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TweetCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TweetCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have tweet input defined', () => {
    expect(component.tweet).toBeDefined();
  });
});
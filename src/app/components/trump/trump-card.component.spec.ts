import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrumpCardComponent } from './trump-card.component';
import { TrumpItem } from '../../models';

describe('TrumpCardComponent', () => {
  let component: TrumpCardComponent;
  let fixture: ComponentFixture<TrumpCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrumpCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrumpCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have item input defined', () => {
    expect(component.item).toBeDefined();
  });

  it('renders the severity label coming from centralized thresholds', () => {
    const item: TrumpItem = {
      id: '1',
      tweetId: 'tweet-1',
      content: 'Major policy action',
      type: 'decision',
      criticality: 8,
      sentiment: 'neutral',
      keywords: 'policy',
      url: 'https://example.com',
      likes: 10,
      retweets: 2,
      isBreaking: true,
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('CRITIQUE 8/10');
    expect(text).toContain('BREAKING');
  });

  it('falls back to low severity visuals for non-critical posts', () => {
    const item: TrumpItem = {
      id: '2',
      tweetId: 'tweet-2',
      content: 'Campaign rally recap',
      type: 'tweet',
      criticality: 2,
      sentiment: 'positive',
      keywords: 'rally',
      url: 'https://example.com',
      likes: 3,
      retweets: 1,
      isBreaking: false,
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    expect(component.getCriticalityLabel()).toBe('FAIBLE');
    expect(component.getCriticalityClass()).toContain('green');
  });
});

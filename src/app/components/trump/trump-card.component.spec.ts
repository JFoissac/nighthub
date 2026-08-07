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

  it('renders the media image for text posts that also carry media (texte + image)', () => {
    const item: TrumpItem = {
      id: '3',
      tweetId: 'tweet-3',
      content: 'So beautiful! D.C. is better than ever.',
      type: 'tweet',
      criticality: 3,
      sentiment: 'positive',
      keywords: '',
      url: 'https://example.com',
      likes: 10,
      retweets: 2,
      isBreaking: false,
      isImageOnly: false,
      mediaType: 'image',
      mediaUrls: 'https://cdn.example.com/photo.jpg',
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/photo.jpg');
    // Le texte reste affiché sous l'image
    expect(fixture.nativeElement.textContent).toContain('So beautiful! D.C. is better than ever.');
  });

  it('does not render an image when mediaUrls is empty', () => {
    const item: TrumpItem = {
      id: '4',
      tweetId: 'tweet-4',
      content: 'Plain text tweet',
      type: 'tweet',
      criticality: 1,
      sentiment: 'neutral',
      keywords: '',
      url: 'https://example.com',
      likes: 0,
      retweets: 0,
      isBreaking: false,
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeFalsy();
    expect(fixture.nativeElement.textContent).toContain('Plain text tweet');
  });

  it('renders the AI relevance badge with tooltip when aiRelevance is set', () => {
    const item: TrumpItem = {
      id: '5',
      tweetId: 'tweet-5',
      content: 'Nouvelle frappe militaire',
      type: 'decision',
      criticality: 8,
      sentiment: 'neutral',
      keywords: 'frappe',
      url: 'https://example.com',
      likes: 100,
      retweets: 50,
      isBreaking: true,
      aiRelevance: 9,
      aiSummary: 'Frappe annoncée',
      aiReason: 'Événement majeur',
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('IA 9/10');
    expect(component.getAiTooltip()).toContain('Frappe annoncée');
    expect(component.getAiTooltip()).toContain('Événement majeur');
  });

  it('does not render the AI badge without aiRelevance', () => {
    const item: TrumpItem = {
      id: '6',
      tweetId: 'tweet-6',
      content: 'Hello',
      type: 'tweet',
      criticality: 2,
      sentiment: 'neutral',
      keywords: '',
      url: 'https://example.com',
      likes: 0,
      retweets: 0,
      isBreaking: false,
      tweetDate: new Date('2026-06-10T08:00:00.000Z'),
    };

    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('IA ');
  });
});

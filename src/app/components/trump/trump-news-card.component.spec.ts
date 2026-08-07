import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrumpNewsCardComponent } from './trump-news-card.component';
import { TrumpNewsItem } from '../../models';

const mockNews = (overrides: Partial<TrumpNewsItem> = {}): TrumpNewsItem => ({
  id: 'n1',
  title: 'Tirs lors d\'un meeting de Donald Trump',
  source: 'lemonde',
  url: 'https://example.com/article',
  summary: 'Le président a été évacué par le Secret Service.',
  pubDate: new Date('2026-08-07T10:00:00.000Z'),
  criticality: 9,
  isBreaking: true,
  matchedKeywords: 'tirs, président',
  ...overrides,
});

describe('TrumpNewsCardComponent', () => {
  let component: TrumpNewsCardComponent;
  let fixture: ComponentFixture<TrumpNewsCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrumpNewsCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TrumpNewsCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the Breaking TV/News badge for breaking items', () => {
    fixture.componentRef.setInput('item', mockNews());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('BREAKING TV/NEWS');
    expect(fixture.nativeElement.textContent).toContain('lemonde');
    expect(fixture.nativeElement.textContent).toContain('Tirs lors d\'un meeting de Donald Trump');
  });

  it('shows the AI relevance score when aiRelevance is present', () => {
    fixture.componentRef.setInput('item', mockNews({ aiRelevance: 8, aiReason: 'Événement majeur' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('IA 8/10');
    expect(component.aiReason()).toContain('Événement majeur');
  });

  it('falls back to the criticality score without AI', () => {
    fixture.componentRef.setInput('item', mockNews({ aiRelevance: 0, isBreaking: false, criticality: 6 }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('SCORE 6/10');
    expect(fixture.nativeElement.textContent).not.toContain('BREAKING');
  });

  it('renders no badge when both scores are zero', () => {
    fixture.componentRef.setInput('item', mockNews({ aiRelevance: 0, criticality: 0, isBreaking: false }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('/10');
  });

  it('renders matched keywords', () => {
    fixture.componentRef.setInput('item', mockNews());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('# tirs, président');
  });
});

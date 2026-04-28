import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AiNewsItem } from '../../models';
import { NewsStore } from '../../stores/news.store';
import { NewsSectionComponent } from './news-section.component';

describe('NewsSectionComponent', () => {
  let fixture: ComponentFixture<NewsSectionComponent>;
  let component: NewsSectionComponent;
  let mockApiService: any;
  let mockNewsStore: any;

  const newsItem: AiNewsItem = {
    id: 'news-1',
    title: 'AI Launch',
    source: 'openai',
    url: 'https://example.com/news/ai-launch',
    summary: 'Summary',
    pubDate: '2026-04-28T10:00:00.000Z',
    isNew: true,
  };

  beforeEach(async () => {
    mockApiService = {
      getTrumpTweets: jest.fn().mockReturnValue(of([])),
      extractNewsArticle: jest.fn().mockReturnValue(of({
        title: 'AI Launch Full Text',
        source: 'example.com',
        content: 'Paragraph 1.\n\nParagraph 2.',
        url: newsItem.url,
      })),
    };

    mockNewsStore = {
      news: signal([newsItem]),
      isLoading: signal(false),
      count: signal(1),
      loadMore: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NewsSectionComponent],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    })
      .overrideProvider(NewsStore, { useValue: mockNewsStore })
      .compileComponents();

    fixture = TestBed.createComponent(NewsSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function clickArticleCard() {
    const card = fixture.nativeElement.querySelector('app-ai-news-card div[role="button"]') as HTMLElement;
    expect(card).toBeTruthy();
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('clicking article triggers extraction API call', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'AI Launch Full Text',
        source: 'example.com',
        content: 'Paragraph 1.\n\nParagraph 2.',
        url: newsItem.url,
      }),
    } as Response);
    global.fetch = fetchSpy;

    clickArticleCard();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/news/extract',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newsItem.url }),
      })
    );
  });

  it('opens in-app popup with extracted raw text on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: 'AI Launch Full Text',
        source: 'example.com',
        content: 'Paragraph 1.\n\nParagraph 2.',
        url: newsItem.url,
      }),
    } as Response);

    clickArticleCard();
    await fixture.whenStable();
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('app-news-article-reader-popup');
    expect(popup).toBeTruthy();
    const text = (popup as HTMLElement).textContent || '';
    expect(text).toContain('AI Launch Full Text');
    expect(text).toContain('EXAMPLE.COM');
    expect(text).toContain('Paragraph 1.');
  });

  it('opens original URL in new tab with noopener,noreferrer on extraction failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ARTICLE_EXTRACTION_FAILED'));
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    clickArticleCard();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(openSpy).toHaveBeenCalledWith(newsItem.url, '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('sorts items by most recent date when mode is date', () => {
    const older = {
      ...newsItem,
      id: 'news-older',
      pubDate: '2026-04-27T08:00:00.000Z',
    };
    const newer = {
      ...newsItem,
      id: 'news-newer',
      pubDate: '2026-04-28T12:00:00.000Z',
    };
    mockNewsStore.news.set([older, newer]);
    fixture.detectChanges();

    const sorted = component.sortedNews();
    expect(sorted[0].id).toBe('news-newer');
    expect(sorted[1].id).toBe('news-older');
  });

  it('requests more items when infinite scroll reaches end', () => {
    const sentinel = fixture.debugElement.query(By.css('[appInfiniteScroll]'));
    expect(sentinel).toBeTruthy();

    sentinel.triggerEventHandler('scrolledToEnd', undefined);
    expect(mockNewsStore.loadMore).toHaveBeenCalled();
  });
});

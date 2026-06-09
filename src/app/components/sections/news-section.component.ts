import { Component, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NewsStore } from '../../stores/news.store';
import { ApiService, ExtractedNewsArticle } from '../../services/api.service';
import { AiNewsCardComponent } from '../ai-news/ai-news-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { RssDetectModalComponent } from '../rss-detect-modal/rss-detect-modal.component';
import { NewsArticleReaderPopupComponent } from '../news-article-reader-popup/news-article-reader-popup.component';
import { AiNewsItem } from '../../models';

const AUTHORITY_SCORE: Record<string, number> = {
  'anthropic': 1.0,
  'openai': 1.0,
  'kimi': 1.0,
  'next.ink': 0.7,
  'numerama': 0.6,
  'frandroid': 0.4,
};

const HIGH_SIGNAL_KEYWORDS = [
  'launch', 'release', 'announce', 'introduce', 'reveal',
  'gpt', 'claude', 'gemini', 'llama', 'mistral', 'kimi',
  'benchmark', 'study', 'research', 'breakthrough', '超越',
  'interview', 'ceo', 'founder', 'exclusive',
  'safety', 'alignment', 'policy', 'regulation',
  'api', 'model', 'training', 'inference',
];

const TRUMP_TOPIC_KEYWORDS = [
  'tariff', 'trade', 'china', 'nuclear', 'war', 'military',
  'election', 'congress', 'supreme court', 'vote',
  'economy', 'inflation', 'billion', 'tax', 'fed',
  'ukraine', 'israel', 'iran', 'russia', 'nato',
  'border', 'immigration', 'deport',
  'sanctions', 'executive order', 'decree',
];

const RELEVANCE_HALFLIFE_HOURS = 12;
const RECENCY_WEIGHT = 0.30;
const AUTHORITY_WEIGHT = 0.25;
const QUALITY_WEIGHT = 0.20;
const CROSS_SECTION_WEIGHT = 0.25;

function calculateRelevanceScore(
  item: AiNewsItem,
  crossSectionKeywords: string[],
  streamGames: string[],
  videoCategories: string[]
): number {
  const pubDate = item.pubDate || item.timestamp?.toISOString() || new Date().toISOString();
  const hoursOld = (Date.now() - new Date(pubDate).getTime()) / 3_600_000;
  const recency = Math.pow(0.5, hoursOld / RELEVANCE_HALFLIFE_HOURS);

  const authority = AUTHORITY_SCORE[item.source?.toLowerCase()] ?? 0.5;

  const hasSummary = item.summary && item.summary.length > 20 ? 0.2 : 0;
  const titleLen = item.title.length;
  const lenScore = titleLen < 20 ? 0.05 : titleLen > 120 ? 0.1 : titleLen > 80 ? 0.15 : 0.2;
  const titleLower = item.title.toLowerCase();
  const keywordBoost = HIGH_SIGNAL_KEYWORDS.some(k => titleLower.includes(k)) ? 0.2 : 0;
  const quality = Math.min(0.4, hasSummary + lenScore + keywordBoost);

  let crossBoost = 0;
  if (crossSectionKeywords.length > 0) {
    const text = `${item.title} ${item.summary || ''} ${item.categories || ''}`.toLowerCase();
    const matchCount = crossSectionKeywords.filter(kw => text.includes(kw)).length;
    crossBoost = Math.min(0.5, matchCount * 0.08);
  }

  if (streamGames.length > 0) {
    const gameMatch = streamGames.some(g => titleLower.includes(g.toLowerCase()));
    if (gameMatch) crossBoost += 0.1;
  }

  if (videoCategories.length > 0) {
    const catMatch = videoCategories.some(c => titleLower.includes(c.toLowerCase()));
    if (catMatch) crossBoost += 0.1;
  }

  const isNewBonus = item.isNew ? 0.05 : 0;

  return (recency * RECENCY_WEIGHT)
    + (authority * AUTHORITY_WEIGHT)
    + (quality * QUALITY_WEIGHT)
    + (crossBoost * CROSS_SECTION_WEIGHT)
    + isNewBonus;
}

@Component({
  selector: 'app-news-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AiNewsCardComponent, InfiniteScrollDirective, RssDetectModalComponent, NewsArticleReaderPopupComponent],
  template: `
    <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 150ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">AI BLOG</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ sortedNews().length }})</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[9px] text-text-muted">ANTHROPIC · OPENAI · KIMI</span>
          @if (store.isLoading()) {
            <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
          }
          <span class="font-label-caps text-[8px] px-1 py-0.5 rounded"
            [class]="sortMode() === 'date' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/20 text-yellow-400'"
          >{{ sortMode() === 'date' ? 'DATE' : 'PERTINENCE' }}</span>
          <button
            (click)="toggleSort()"
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
            aria-label="Changer le mode de tri"
          >
            @if (sortMode() === 'date') {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            } @else {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            }
          </button>
          <button
            (click)="showRssDetect.set(true)"
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
            aria-label="Ajouter un flux RSS"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @if (store.isLoading() && !store.count()) {
          <div class="space-y-3 p-4">
            @for (placeholder of [1, 2, 3]; track placeholder) {
              <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/40 p-4 space-y-3 animate-pulse">
                <div class="h-3 w-20 rounded bg-[#1E1E2E]/70"></div>
                <div class="h-4 w-11/12 rounded bg-[#1E1E2E]/60"></div>
                <div class="h-3 w-4/5 rounded bg-[#1E1E2E]/50"></div>
                <div class="flex gap-2 pt-1">
                  <div class="h-5 w-14 rounded-full bg-[#1E1E2E]/40"></div>
                  <div class="h-5 w-20 rounded-full bg-[#1E1E2E]/30"></div>
                </div>
              </div>
            }
          </div>
        }
        @for (item of sortedNews(); track item.id || $index) {
          <app-ai-news-card
            [item]="item"
            (articleClick)="onArticleClick($event, item)"
          ></app-ai-news-card>
        }
        <div
          appInfiniteScroll
          [disabled]="store.isLoading()"
          (scrolledToEnd)="store.loadMore()"
          class="h-1"
        ></div>
        @if (store.isLoading()) {
          <div class="text-center py-2">
            <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
          </div>
        }
        @if (!store.isLoading() && !store.count()) {
          <p class="font-label-caps text-[10px] text-text-muted p-4">NO ARTICLES</p>
        }
      </div>
    </section>

    @if (showRssDetect()) {
      <app-rss-detect-modal
        (close)="showRssDetect.set(false)"
        (feedAdded)="onFeedAdded($event)"
      ></app-rss-detect-modal>
    }

    @if (readerArticle()) {
      <app-news-article-reader-popup
        [article]="readerArticle()!"
        (close)="closeReaderPopup()"
      ></app-news-article-reader-popup>
    }
  `,
})
export class NewsSectionComponent {
  readonly store = inject(NewsStore);
  private apiService = inject(ApiService);

  feedAdded = output<string>();

  sortMode = signal<'date' | 'relevance'>('date');
  showRssDetect = signal(false);
  readerArticle = signal<ExtractedNewsArticle | null>(null);
  trumpKeywords = signal<string[]>([]);
  streamGames = signal<string[]>([]);
  videoCategories = signal<string[]>([]);

  constructor() {
    this.loadCrossSectionSignals();
  }

  private loadCrossSectionSignals() {
    this.apiService.getTrumpTweets(10).subscribe({
      next: (tweets) => {
        const keywords = new Set<string>();
        tweets.forEach((t: any) => {
          if (t.keywords) {
            t.keywords.split(',').forEach((k: string) => keywords.add(k.trim().toLowerCase()));
          }
          if (t.criticality >= 7) {
            TRUMP_TOPIC_KEYWORDS.forEach(kw => {
              if ((t.content || '').toLowerCase().includes(kw)) keywords.add(kw);
            });
          }
        });
        this.trumpKeywords.set([...keywords]);
      },
      error: () => this.trumpKeywords.set([]),
    });
  }

  setStreamGames(games: string[]) {
    this.streamGames.set(games);
  }

  setVideoCategories(categories: string[]) {
    this.videoCategories.set(categories);
  }

  sortedNews = computed(() => {
    const items = this.store.news();
    const mode = this.sortMode();
    if (mode === 'date') {
      return [...items].sort((a, b) => {
        const pubDateA = (a as any).pubDate || a.timestamp?.toISOString() || '';
        const pubDateB = (b as any).pubDate || b.timestamp?.toISOString() || '';
        const dateA = new Date(pubDateA).getTime();
        const dateB = new Date(pubDateB).getTime();
        if (Number.isNaN(dateA)) return 1;
        if (Number.isNaN(dateB)) return -1;
        return dateB - dateA;
      });
    }
    const keywords = this.trumpKeywords();
    const games = this.streamGames();
    const cats = this.videoCategories();
    return [...items]
      .map(item => ({ item, score: calculateRelevanceScore(item, keywords, games, cats) }))
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  });

  toggleSort() {
    this.sortMode.set(this.sortMode() === 'date' ? 'relevance' : 'date');
  }

  onFeedAdded(feedUrl: string) {
    this.showRssDetect.set(false);
    this.feedAdded.emit(feedUrl);
  }

  onArticleClick(event: Event, item: AiNewsItem) {
    event.preventDefault();
    event.stopPropagation();

    if (!item.url) {
      return;
    }

    this.apiService.extractNewsArticle(item.url).subscribe({
      next: (article) => this.readerArticle.set(article),
      error: (err) => {
        console.error('[News] extract failed:', err);
        this.openOriginalArticle(item.url);
      },
    });
  }

  closeReaderPopup() {
    this.readerArticle.set(null);
  }

  private openOriginalArticle(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

import { Component, output, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LoaderCircle, Calendar, Star, Plus } from 'lucide-angular';
import { NewsStore } from '../../stores/news.store';
import { ApiService, ExtractedNewsArticle } from '../../services/api.service';
import { AiNewsCardComponent } from '../ai-news/ai-news-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { RssDetectModalComponent } from '../rss-detect-modal/rss-detect-modal.component';
import { NewsArticleReaderPopupComponent } from '../news-article-reader-popup/news-article-reader-popup.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
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
  imports: [CommonModule, LucideAngularModule, AiNewsCardComponent, InfiniteScrollDirective, RssDetectModalComponent, NewsArticleReaderPopupComponent, SkeletonComponent, EmptyStateComponent],
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
            <lucide-icon [name]="LoaderCircle" size="14" class="animate-spin text-primary"></lucide-icon>
          }
          <span class="font-label-caps text-[10px] px-1 py-0.5 rounded"
            [class]="sortMode() === 'date' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/20 text-yellow-400'"
          >{{ sortMode() === 'date' ? 'DATE' : 'PERTINENCE' }}</span>
          <button
            (click)="toggleSort()"
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
            aria-label="Changer le mode de tri"
          >
            @if (sortMode() === 'date') {
              <lucide-icon [name]="Calendar" size="14"></lucide-icon>
            } @else {
              <lucide-icon [name]="Star" size="14"></lucide-icon>
            }
          </button>
          <button
            (click)="showRssDetect.set(true)"
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
            aria-label="Ajouter un flux RSS"
          >
            <lucide-icon [name]="Plus" size="14"></lucide-icon>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @if (store.isLoading() && !store.count()) {
          <app-skeleton variant="card" />
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
            <app-skeleton variant="text" />
          </div>
        }
        @if (!store.isLoading() && !store.count()) {
          <app-empty-state title="NO ARTICLES" layout="start"></app-empty-state>
        }
      </div>
    </section>

    @if (showRssDetect()) {
      <app-rss-detect-modal
        (closed)="showRssDetect.set(false)"
        (feedAdded)="onFeedAdded($event)"
      ></app-rss-detect-modal>
    }

    @if (readerArticle()) {
      <app-news-article-reader-popup
        [article]="readerArticle()!"
        (closed)="closeReaderPopup()"
      ></app-news-article-reader-popup>
    }
  `,
})
export class NewsSectionComponent {
  readonly LoaderCircle = LoaderCircle;
  readonly Calendar = Calendar;
  readonly Star = Star;
  readonly Plus = Plus;

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

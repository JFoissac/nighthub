import { Component, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiNewsItem } from '../../models';
import { NewsStore } from '../../stores/news.store';
import { ApiService } from '../../services/api.service';
import { AiNewsCardComponent } from '../ai-news/ai-news-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { RssDetectModalComponent } from '../rss-detect-modal/rss-detect-modal.component';

@Component({
  selector: 'app-news-section',
  standalone: true,
  imports: [CommonModule, AiNewsCardComponent, InfiniteScrollDirective, RssDetectModalComponent],
  template: `
    <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 150ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">AI BLOG</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ sortedNews().length }})</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[9px] text-text-muted">ANTHROPIC · OPENAI · KIMI · RSS</span>
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
            title="Toggle sort mode"
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
            title="Ajouter un flux RSS"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @for (item of sortedNews(); track item.id || $index) {
          <app-ai-news-card [item]="item"></app-ai-news-card>
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
        @if (!store.count()) {
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
  `,
})
export class NewsSectionComponent {
  readonly store = inject(NewsStore);
  private apiService = inject(ApiService);

  feedAdded = output<string>();

  sortMode = signal<'date' | 'relevance'>('date');
  showRssDetect = signal(false);

  sortedNews = computed(() => {
    const items = this.store.news();
    const mode = this.sortMode();
    if (mode === 'date') {
      return [...items].sort((a, b) => {
        const dateA = new Date(a.timestamp?.getTime() || 0);
        const dateB = new Date(b.timestamp?.getTime() || 0);
        return dateB.getTime() - dateA.getTime();
      });
    }
    return items;
  });

  toggleSort() {
    this.sortMode.set(this.sortMode() === 'date' ? 'relevance' : 'date');
  }

  onFeedAdded(feedUrl: string) {
    this.showRssDetect.set(false);
    this.feedAdded.emit(feedUrl);
  }
}
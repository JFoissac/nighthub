import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TweetItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { TweetCardComponent } from '../tweet/tweet-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';

@Component({
  selector: 'app-twitter-section',
  standalone: true,
  imports: [CommonModule, TweetCardComponent, InfiniteScrollDirective],
  template: `
    <section class="lg:col-span-5 neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 0ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">LATEST @X / TWITTER</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ tweets().length || 0 }})</span>
        </div>
        @if (isLoadingMore()) {
          <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
        }
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 380px">
        @for (tweet of tweets(); track tweet.id || $index) {
          <app-tweet-card [tweet]="tweet"></app-tweet-card>
        }
        <div
          appInfiniteScroll
          [disabled]="isLoadingMore()"
          (scrolledToEnd)="loadMore()"
          class="h-1"
        ></div>
        @if (isLoadingMore()) {
          <div class="text-center py-2">
            <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
          </div>
        }
        @if (!tweets().length) {
          <div class="p-6 text-center">
            <p class="font-label-caps text-[10px] text-text-muted mb-2">SERVICE UNAVAILABLE</p>
            <p class="text-[10px] text-text-muted/60">X / Twitter feed is temporarily disabled.</p>
          </div>
        }
      </div>
    </section>
  `,
})
export class TwitterSectionComponent {
  private apiService = inject(ApiService);

  tweets = input<TweetItem[]>([]);
  isLoadingMore = input<boolean>(false);

  private limit = signal(20);
  private maxLimit = 100;

  loadMore() {
    console.log('[TwitterSection] loadMore — Twitter/X disabled, no-op');
  }
}
import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrumpItem } from '../../models';
import { ApiService } from '../../services/api.service';
import { TrumpCardComponent } from '../trump/trump-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';

@Component({
  selector: 'app-trump-section',
  standalone: true,
  imports: [CommonModule, TrumpCardComponent, InfiniteScrollDirective],
  template: `
    <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 200ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TRUMP WATCH</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ items().length || 0 }})</span>
        </div>
        <div class="flex items-center gap-2">
          @if (isLoadingMore()) {
            <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
          }
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400">CRITICALITY</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @for (item of items(); track item.tweetId || item.id || $index) {
          <app-trump-card [item]="item"></app-trump-card>
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
        @if (!items().length) {
          <p class="font-label-caps text-[10px] text-text-muted p-4">NO DATA</p>
        }
      </div>
    </section>
  `,
})
export class TrumpSectionComponent {
  private apiService = inject(ApiService);

  items = input<TrumpItem[]>([]);

  private limit = signal(20);
  private isLoading = signal(false);
  private maxLimit = 100;

  isLoadingMore() { return this.isLoading(); }

  loadMore() {
    const current = this.limit();
    const next = Math.min(current + 20, this.maxLimit);
    if (this.isLoading() || next === current) return;
    this.isLoading.set(true);
    this.apiService.getTrumpTweets(next).subscribe({
      next: (trump) => {
        this.limit.set(next);
        this.isLoading.set(false);
        if (trump.length < next) this.limit.set(this.maxLimit);
      },
      error: (e) => { console.error('[TrumpSection] loadMore error:', e); this.isLoading.set(false); },
    });
  }
}
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LoaderCircle } from 'lucide-angular';
import { TrumpNewsItem } from '../../models';
import { TrumpStore } from '../../stores/trump.store';
import { ApiService } from '../../services/api.service';
import { TrumpNewsService } from '../../services/trump-news.service';
import { TrumpCardComponent } from '../trump/trump-card.component';
import { TrumpNewsCardComponent } from '../trump/trump-news-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-trump-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, TrumpCardComponent, TrumpNewsCardComponent, InfiniteScrollDirective, SkeletonComponent, EmptyStateComponent],
  template: `
    <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 200ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TRUMP WATCH</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ store.count() }})</span>
          @if (hasBreakingNews()) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded animate-pulse">BREAKING</span>
          }
        </div>
        <div class="flex items-center gap-2">
          @if (store.isLoading()) {
            <lucide-icon [name]="LoaderCircle" size="14" class="animate-spin text-primary"></lucide-icon>
          }
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400">CRITICALITY</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @if (news().length) {
          <div class="border-b border-[#1E1E2E] bg-[#131318]/20">
            <div class="px-4 pt-2.5 pb-1 flex items-center justify-between">
              <span class="font-label-caps text-[9px] tracking-widest text-text-muted">📺 TV / NEWS</span>
              @if (hasBreakingNews()) {
                <span class="font-label-caps text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded animate-pulse">BREAKING TV/NEWS</span>
              }
            </div>
            @for (n of news(); track n.id) {
              <app-trump-news-card [item]="n"></app-trump-news-card>
            }
          </div>
        }
        @if (store.isLoading() && !store.count()) {
          <app-skeleton variant="post" />
        }
        @for (item of store.items(); track item.tweetId || item.id || $index) {
          <app-trump-card [item]="item"></app-trump-card>
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
          <app-empty-state title="NO DATA" layout="start"></app-empty-state>
        }
      </div>
    </section>
  `,
})
export class TrumpSectionComponent implements OnInit {
  readonly LoaderCircle = LoaderCircle;

  readonly store = inject(TrumpStore);
  private readonly api = inject(ApiService);
  private readonly trumpNews = inject(TrumpNewsService);

  readonly news = signal<TrumpNewsItem[]>([]);

  readonly hasBreakingNews = computed(() => this.news().some((n) => n.isBreaking));

  ngOnInit() {
    window.setTimeout(() => {
      if (this.store.count()) return;

      this.api.getTrumpTweets(20).subscribe({
        next: (items) => this.store.setItems(items),
        error: () => this.store.setLoading(false),
      });
    });

    window.setTimeout(() => {
      this.trumpNews.getTrumpNews(8).subscribe({
        next: (items) => this.news.set(items),
        error: () => this.news.set([]),
      });
    });
  }
}

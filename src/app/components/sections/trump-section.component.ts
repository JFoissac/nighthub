import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrumpItem } from '../../models';
import { TrumpStore } from '../../stores/trump.store';
import { TrumpCardComponent } from '../trump/trump-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';

@Component({
  selector: 'app-trump-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TrumpCardComponent, InfiniteScrollDirective],
  template: `
    <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 200ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TRUMP WATCH</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ store.count() }})</span>
        </div>
        <div class="flex items-center gap-2">
          @if (store.isLoading()) {
            <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
            </svg>
          }
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400">CRITICALITY</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto" style="max-height: 500px">
        @if (store.isLoading() && !store.count()) {
          <div class="space-y-3 p-4">
            @for (placeholder of [1, 2, 3]; track placeholder) {
              <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/40 p-4 animate-pulse space-y-3">
                <div class="flex items-center justify-between">
                  <div class="h-3 w-28 rounded bg-[#1E1E2E]/70"></div>
                  <div class="h-5 w-16 rounded-full bg-[#1E1E2E]/40"></div>
                </div>
                <div class="h-3 w-11/12 rounded bg-[#1E1E2E]/60"></div>
                <div class="h-3 w-4/5 rounded bg-[#1E1E2E]/50"></div>
              </div>
            }
          </div>
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
            <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
          </div>
        }
        @if (!store.isLoading() && !store.count()) {
          <p class="font-label-caps text-[10px] text-text-muted p-4">NO DATA</p>
        }
      </div>
    </section>
  `,
})
export class TrumpSectionComponent {
  readonly store = inject(TrumpStore);
}

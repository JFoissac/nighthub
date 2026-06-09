import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoCardComponent } from '../video/video-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { VideosStore } from '../../stores/videos.store';

@Component({
  selector: 'app-youtube-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, VideoCardComponent, InfiniteScrollDirective],
  template: `
    <section class="lg:col-span-7 neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 50ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">YOUTUBE RECAPS</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ store.count() }})</span>
        </div>
        @if (store.isLoading()) {
          <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
        }
      </div>
      <div class="flex-1 p-4 space-y-4 overflow-y-auto" style="max-height: 380px">
        @if (store.isLoading() && !store.count()) {
          <div class="space-y-3">
            @for (placeholder of [1, 2, 3]; track placeholder) {
              <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/50 p-3 flex gap-3 animate-pulse">
                <div class="w-32 h-18 rounded-lg bg-[#1E1E2E]/70 shrink-0"></div>
                <div class="flex-1 space-y-2 pt-1">
                  <div class="h-3 w-5/6 rounded bg-[#1E1E2E]/70"></div>
                  <div class="h-3 w-2/3 rounded bg-[#1E1E2E]/50"></div>
                  <div class="h-2 w-24 rounded bg-[#1E1E2E]/40"></div>
                </div>
              </div>
            }
          </div>
        }
        @for (video of store.videos(); track video.id || $index) {
          <app-video-card [video]="video" (select)="selectVideo.emit($event)"></app-video-card>
        }
        <div
          appInfiniteScroll
          [disabled]="store.isLoading() || store.atEnd()"
          (scrolledToEnd)="store.loadMore()"
          class="h-1"
        ></div>
        @if (store.isLoading()) {
          <div class="text-center py-2">
            <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
          </div>
        }
        @if (!store.isLoading() && !store.count()) {
          <div class="text-center py-6">
            <p class="font-label-caps text-[10px] text-text-muted mb-2">NO CHANNELS CONFIGURED</p>
            <button (click)="openSettings.emit()" class="font-label-caps text-[10px] text-primary underline">CONFIGURE</button>
          </div>
        }
      </div>
    </section>
  `,
})
export class YoutubeSectionComponent {
  readonly store = inject(VideosStore);

  selectVideo = output<any>();
  openSettings = output<void>();
}

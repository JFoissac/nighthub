import { Component, input, output, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubeVideo } from '../../models';
import { ApiService } from '../../services/api.service';
import { VideoCardComponent } from '../video/video-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';

@Component({
  selector: 'app-youtube-section',
  standalone: true,
  imports: [CommonModule, VideoCardComponent, InfiniteScrollDirective],
  template: `
    <section class="lg:col-span-7 neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 50ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">YOUTUBE RECAPS</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ videos().length || 0 }}/{{ limit() }})</span>
        </div>
        @if (isLoadingMore()) {
          <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
          </svg>
        }
      </div>
      <div class="flex-1 p-4 space-y-4 overflow-y-auto" style="max-height: 380px">
        @for (video of videos(); track video.id || $index) {
          <app-video-card [video]="video" (select)="selectVideo.emit($event)"></app-video-card>
        }
        <div
          appInfiniteScroll
          [disabled]="isLoadingMore() || atEnd()"
          (scrolledToEnd)="loadMore()"
          class="h-1"
        ></div>
        @if (isLoadingMore()) {
          <div class="text-center py-2">
            <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
          </div>
        }
        @if (!videos().length) {
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
  private apiService = inject(ApiService);

  videos = input<YoutubeVideo[]>([]);

  selectVideo = output<YoutubeVideo>();
  openSettings = output<void>();

  limit = signal(20);
  atEnd = signal(false);
  private isLoading = signal(false);
  private maxLimit = 100;

  isLoadingMore() { return this.isLoading(); }

  loadMore() {
    if (this.isLoading() || this.atEnd()) return;
    const current = this.limit();
    const next = Math.min(current + 20, this.maxLimit);
    console.log(`[YoutubeSection] loadMore — current=${current} next=${next}`);
    this.isLoading.set(true);
    const minDisplay = setTimeout(() => {
      if (this.isLoading()) {
        console.log('[YoutubeSection] loading still in progress after 1s');
      }
    }, 1000);
    this.apiService.getVideos(next).subscribe({
      next: (videos) => {
        clearTimeout(minDisplay);
        console.log(`[YoutubeSection] received ${videos.length} videos`, videos);
        this.limit.set(next);
        this.isLoading.set(false);
        if (videos.length < next) this.atEnd.set(true);
      },
      error: (e) => { console.error('[YoutubeSection] loadMore error:', e); clearTimeout(minDisplay); this.isLoading.set(false); },
    });
  }
}
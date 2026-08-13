import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LoaderCircle } from 'lucide-angular';
import { VideoCardComponent } from '../video/video-card.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { VideosStore } from '../../stores/videos.store';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'app-youtube-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule, VideoCardComponent, InfiniteScrollDirective, SkeletonComponent, EmptyStateComponent],
  template: `
    <section role="region" aria-label="YouTube — Abonnements" class="lg:col-span-7 neo-glass rounded overflow-hidden flex flex-col fade-in h-[424px]" style="animation-delay: 50ms">
      <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
        <div class="flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">YOUTUBE RECAPS</span>
          <span class="font-label-caps text-[9px] text-text-muted">({{ store.count() }})</span>
        </div>
        @if (store.isLoading()) {
          <lucide-icon [name]="LoaderCircle" size="14" class="animate-spin text-primary"></lucide-icon>
        }
      </div>
      <div class="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto">
        @if (store.isLoading() && !store.count()) {
          <app-skeleton variant="thumbnail" />
        }
        @for (video of store.videos(); track video.id || $index) {
          <app-video-card [video]="video" (selected)="selectVideo.emit($event)"></app-video-card>
        }
        <div
          appInfiniteScroll
          [disabled]="store.isLoading() || store.atEnd()"
          (scrolledToEnd)="store.loadMore()"
          class="h-1"
        ></div>
        @if (store.isLoading()) {
          <div class="text-center py-2">
            <app-skeleton variant="text" />
          </div>
        }
        @if (!store.isLoading() && !store.count()) {
          <app-empty-state
            title="NO CHANNELS CONFIGURED"
            actionLabel="CONFIGURE"
            (action)="openSettings.emit()"
          ></app-empty-state>
        }
      </div>
    </section>
  `,
})
export class YoutubeSectionComponent {
  readonly LoaderCircle = LoaderCircle;

  readonly store = inject(VideosStore);

  selectVideo = output<any>();
  openSettings = output<void>();
}

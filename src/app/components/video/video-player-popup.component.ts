import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { YoutubeVideo } from '../../models';

@Component({
  selector: 'app-video-player-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4"
         (click)="close.emit()">

      <!-- Modal -->
      <div class="w-full max-w-3xl bg-[#0e0e13] border border-[#1E1E2E] rounded overflow-hidden shadow-2xl flex flex-col"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-start gap-3 px-4 py-3 border-b border-[#1E1E2E] bg-[#131318]/60 flex-shrink-0">
          <div class="min-w-0 flex-1">
            <p class="text-[13px] font-medium text-text-primary line-clamp-1">{{ video().title }}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="font-label-caps text-[9px] text-secondary">{{ video().channelName }}</span>
              @if (displayHandle()) {
                <span class="font-label-caps text-[9px] text-primary">{{ displayHandle() }}</span>
              }
              @if (video().views) {
                <span class="font-label-caps text-[9px] text-text-muted">{{ formatViews(video().views) }}</span>
              }
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Side panel button -->
            <button (click)="openPanel.emit(video())"
                    class="flex items-center gap-1.5 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded font-label-caps text-[9px] transition-colors border border-primary/20"
                    title="Ouvrir en side panel">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
              SIDE PANEL
            </button>
            <!-- Open on YouTube -->
            <a [href]="video().url" target="_blank" rel="noopener noreferrer"
               class="flex items-center gap-1.5 px-2 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded font-label-caps text-[9px] transition-colors border border-red-600/20"
               title="Ouvrir sur YouTube"
               (click)="$event.stopPropagation()">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136z"/></svg>
              YOUTUBE
            </a>
            <!-- Close -->
            <button (click)="close.emit()"
                    class="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-[#1E1E2E]">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Player -->
        <div class="aspect-video bg-black">
          <iframe [src]="embedUrl()"
                  class="w-full h-full"
                  allowfullscreen
                  frameborder="0"
                  allow="autoplay; fullscreen; picture-in-picture"></iframe>
        </div>
      </div>
    </div>
  `,
})
export class VideoPlayerPopupComponent {
  video = input.required<YoutubeVideo>();
  close = output<void>();
  openPanel = output<YoutubeVideo>();

  private sanitizer = inject(DomSanitizer);

  embedUrl(): SafeResourceUrl {
    const id = this.getVideoId();
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    );
  }

  private getVideoId(): string {
    const v = this.video();
    if (v.youtubeId) return v.youtubeId;
    const match = v.url.match(/[?&]v=([^&]+)/);
    return match?.[1] || '';
  }

  displayHandle(): string {
    const h = this.video().channelHandle || '';
    return h.startsWith('@') ? h : '';
  }

  formatViews(n: number): string {
    if (!n) return '';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M vues';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K vues';
    return n + ' vues';
  }
}

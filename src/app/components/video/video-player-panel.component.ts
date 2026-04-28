import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { YoutubeVideo } from '../../models';

@Component({
  selector: 'app-video-player-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black/40 z-40" (click)="close.emit()"></div>

    <!-- Panel -->
    <div class="fixed top-0 right-0 h-full w-full md:w-[45%] lg:w-[40%] bg-[#0e0e13] border-l border-[#1E1E2E] z-50 flex flex-col shadow-2xl">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[#1E1E2E] bg-[#131318]/60 flex-shrink-0">
        <div class="min-w-0 flex-1">
          <p class="font-label-caps text-[11px] text-text-primary truncate">
            {{ video().channelName }}
            @if (displayHandle()) {
              <span class="text-primary ml-1">{{ displayHandle() }}</span>
            }
          </p>
          <p class="text-[12px] text-text-secondary truncate mt-0.5">{{ video().title }}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <a [href]="video().url" target="_blank" rel="noopener noreferrer"
             class="flex items-center gap-1.5 px-2 py-1 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded font-label-caps text-[9px] transition-colors border border-red-600/20">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#fff" d="m9.545 15.568 6.273-3.568-6.273-3.568v7.136z"/></svg>
            YOUTUBE
          </a>
          <button (click)="close.emit()"
                  class="p-1.5 rounded hover:bg-[#1E1E2E] transition-colors text-text-muted hover:text-text-primary">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="px-4 py-2 border-b border-[#1E1E2E]/50 bg-[#131318]/40 flex-shrink-0 flex items-center gap-4">
        @if (video().views) {
          <span class="font-label-caps text-[9px] text-text-muted">{{ formatViews(video().views) }}</span>
        }
        @if (video().publishedAt) {
          <span class="font-label-caps text-[9px] text-text-muted">{{ relativeDate(video().publishedAt) }}</span>
        }
      </div>

      <!-- Player -->
      <div class="flex-1 bg-black">
        <iframe [src]="embedUrl()"
                class="w-full h-full"
                allowfullscreen
                frameborder="0"
                allow="autoplay; fullscreen; picture-in-picture"></iframe>
      </div>
    </div>
  `,
})
export class VideoPlayerPanelComponent {
  video = input.required<YoutubeVideo>();
  close = output<void>();

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

  relativeDate(date?: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays}j`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)}sem`;
    return `il y a ${Math.floor(diffDays / 30)}mois`;
  }
}

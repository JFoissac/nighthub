import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { YoutubeVideo } from '../../models';

@Component({
  selector: 'app-video-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (video()) {
      <div class="flex gap-3 group border-b border-[#1E1E2E]/50 pb-3 last:border-0 last:pb-0 cursor-pointer"
           (click)="select.emit(video()!)">
        <!-- Thumbnail -->
        <div class="relative w-32 h-[72px] bg-[#1E1E2E] rounded overflow-hidden flex-shrink-0 border border-[#1E1E2E] group-hover:border-primary transition-colors">
          <img [src]="video()!.thumbnailUrl" [alt]="video()!.title"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <!-- Play overlay -->
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <svg class="w-8 h-8 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          @if (video()!.isNew) {
            <div class="absolute top-1 left-1 px-1 py-0.5 bg-primary text-[#0A0A0F] font-label-caps text-[7px] rounded">NEW</div>
          }
          @if (video()!.duration) {
            <div class="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 font-mono text-[8px] text-white rounded leading-none">{{ video()!.duration }}</div>
          }
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <h4 class="text-[13px] font-medium text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {{ video()!.title }}
          </h4>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
            <span class="font-label-caps text-[9px] text-secondary">{{ video()!.channelName }}</span>
            @if (video()!.views) {
              <span class="font-label-caps text-[9px] text-text-muted">{{ formatViews(video()!.views) }}</span>
            }
            <span class="font-label-caps text-[9px] text-text-muted">{{ relativeDate(video()!.publishedAt || video()!.timestamp) }}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class VideoCardComponent {
  video = input<YoutubeVideo | null>(null);
  select = output<YoutubeVideo>();

  formatViews(n: number): string {
    if (!n) return '';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M vues';
    if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K vues';
    return n + ' vues';
  }

  relativeDate(date?: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "aujourd'hui";
    if (diffDays === 1) return 'hier';
    if (diffDays < 7) return `il y a ${diffDays}j`;
    if (diffDays < 30) return `il y a ${Math.floor(diffDays / 7)}sem`;
    if (diffDays < 365) return `il y a ${Math.floor(diffDays / 30)}mois`;
    return `il y a ${Math.floor(diffDays / 365)}an`;
  }
}

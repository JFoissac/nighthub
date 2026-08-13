import { Component, input, output, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Play } from 'lucide-angular';
import { YoutubeVideo } from '../../models';

@Component({
  selector: 'app-video-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (video()) {
      <div class="flex gap-3 group border-b border-[#1E1E2E]/50 pb-3 last:border-0 last:pb-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
           role="button" tabindex="0"
           (click)="selected.emit(video()!)"
           (keydown.enter)="selected.emit(video()!)"
           (keydown.space)="selected.emit(video()!); $event.preventDefault()">
        <!-- Thumbnail -->
        <div class="relative w-32 h-[72px] bg-[#1E1E2E] rounded overflow-hidden flex-shrink-0 border border-[#1E1E2E] group-hover:border-primary transition-colors">
          <img [src]="video()!.thumbnailUrl" [alt]="video()!.title"
               class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <!-- Play overlay -->
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <lucide-icon [name]="Play" size="32" class="text-white drop-shadow"></lucide-icon>
          </div>
          @if (video()!.isNew) {
            <div class="absolute top-1 left-1 px-1 py-0.5 bg-primary text-[#0A0A0F] font-label-caps text-[10px] rounded">NEW</div>
          }
          @if (video()!.duration) {
            <div class="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 font-mono text-[10px] text-white rounded leading-none">{{ video()!.duration }}</div>
          }
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <h4 class="text-[13px] font-medium text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {{ video()!.title }}
          </h4>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
            <span class="font-label-caps text-[10px] text-secondary">{{ video()!.channelName }}</span>
            @if (video()!.views) {
              <span class="font-label-caps text-[10px] text-text-muted">{{ formatViews(video()!.views) }}</span>
            }
            <span class="font-label-caps text-[10px] text-text-muted">{{ cachedDate() }}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class VideoCardComponent {
  readonly Play = Play;

  video = input<YoutubeVideo | null>(null);
  selected = output<YoutubeVideo>();

  cachedDate = signal('');

  constructor() {
    effect(() => {
      const v = this.video();
      if (v) {
        this.cachedDate.set(this.relativeDate(v.publishedAt || v.timestamp));
      }
    });
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

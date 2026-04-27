import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (stream()) {
      <div class="min-w-[220px] group cursor-pointer flex-shrink-0" (click)="select.emit(stream()!)">
        <div class="relative aspect-video rounded overflow-hidden mb-2 border border-[#1E1E2E] group-hover:border-primary transition-colors">
          <img [src]="stream()!.thumbnailUrl" [alt]="stream()!.title" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          @if (stream()!.isLive) {
            <div class="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-[8px] font-bold rounded text-white">
              <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse flex-shrink-0"></span>
              LIVE
            </div>
          }
          <div class="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 text-[8px] font-bold rounded text-white backdrop-blur">
            {{ formatViewers(stream()!.viewerCount) }}
          </div>
        </div>
        <div class="font-label-caps text-[10px] font-bold truncate text-text-primary">{{ stream()!.channelName }}</div>
        <div class="font-label-caps text-[9px] text-text-muted truncate mt-0.5">{{ stream()!.gameName || 'STREAMING' }}</div>
      </div>
    }
  `,
})
export class StreamCardComponent {
  stream = input<TwitchStream | null>(null);
  select = output<TwitchStream>();

  formatViewers(n: number): string {
    if (!n) return '0';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }
}

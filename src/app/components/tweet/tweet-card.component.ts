import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TweetItem } from '../../models';

@Component({
  selector: 'app-tweet-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (tweet()) {
      <div class="flex gap-3 p-4 border-b border-[#1E1E2E]/50 last:border-0 hover:bg-white/[0.03] transition-colors">
        <div class="w-8 h-8 rounded-full bg-[#1E1E2E] flex-shrink-0 overflow-hidden border border-[#2a292f]">
          <img [src]="tweet()!.authorAvatar" [alt]="tweet()!.authorName" class="w-full h-full object-cover"
               onerror="this.style.display='none'"/>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="font-bold text-[11px] text-text-primary">{{ tweet()!.authorHandle || tweet()!.authorName }}</span>
            <span class="text-text-muted text-[10px]">{{ tweet()!.timestamp | date:'MMM d' }}</span>
          </div>
          <p class="text-[13px] text-text-secondary leading-snug line-clamp-3">{{ tweet()!.content }}</p>
          @if (tweet()!.mediaUrl) {
            <img [src]="tweet()!.mediaUrl" class="mt-2 rounded w-full max-h-32 object-cover border border-[#1E1E2E]"/>
          }
          <div class="flex gap-4 mt-1.5">
            <span class="font-label-caps text-[9px] text-text-muted">♥ {{ formatNum(tweet()!.likes) }}</span>
            <span class="font-label-caps text-[9px] text-text-muted">↺ {{ formatNum(tweet()!.retweets) }}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class TweetCardComponent {
  tweet = input<TweetItem | null>(null);

  formatNum(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}

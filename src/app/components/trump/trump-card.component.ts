import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrumpItem } from '../../models';

@Component({
  selector: 'app-trump-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (item()) {
      <a [href]="item()!.url" target="_blank"
         class="block px-4 py-3 border-b border-[#1E1E2E]/50 last:border-0 hover:bg-white/[0.03] transition-colors"
         [class.border-l-2]="item()!.isBreaking"
         [class.border-l-warning]="item()!.isBreaking">
        <div class="flex items-start gap-2 flex-wrap mb-1.5">
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border"
                [style.borderColor]="getTypeColor() + '50'"
                [style.color]="getTypeColor()">{{ item()!.type }}</span>
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border"
                [class]="getCriticalityClass()">
            {{ getCriticalityLabel() }} {{ item()!.criticality }}/10
          </span>
          @if (item()!.isBreaking) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 bg-warning/20 text-warning border border-warning/30 rounded animate-pulse">BREAKING</span>
          }
        </div>

        <p class="text-[13px] text-text-secondary leading-snug line-clamp-3">{{ item()!.content }}</p>

        <!-- Criticality bar -->
        <div class="mt-2 h-0.5 bg-[#1E1E2E] rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
               [style.width.%]="item()!.criticality * 10"
               [class]="getCriticalityBarClass()"></div>
        </div>

        <div class="flex items-center gap-4 mt-1.5">
          <span class="font-label-caps text-[9px] text-text-muted">♥ {{ formatNumber(item()!.likes) }}</span>
          <span class="font-label-caps text-[9px] text-text-muted">↺ {{ formatNumber(item()!.retweets) }}</span>
          <span class="font-label-caps text-[9px] text-text-muted ml-auto">{{ item()!.tweetDate | date:'MMM d' }}</span>
        </div>
      </a>
    }
  `,
})
export class TrumpCardComponent {
  item = input<TrumpItem | null>(null);

  getTypeIcon(): string {
    const i = this.item();
    if (!i) return '📰';
    switch (i.type) {
      case 'tweet': return '🐦';
      case 'decision': return '📋';
      case 'scandal': return '⚠️';
      case 'statement': return '🎤';
      default: return '📰';
    }
  }

  getTypeClass(): string {
    const i = this.item();
    if (!i) return 'bg-gray-500/20 text-gray-400';
    switch (i.type) {
      case 'tweet': return 'bg-blue-500/20 text-blue-400';
      case 'decision': return 'bg-red-500/20 text-red-400';
      case 'scandal': return 'bg-orange-500/20 text-orange-400';
      case 'statement': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  }

  getTypeColor(): string {
    const i = this.item();
    if (!i) return '#908fa0';
    switch (i.type) {
      case 'tweet': return '#60a5fa';
      case 'decision': return '#f87171';
      case 'scandal': return '#fb923c';
      case 'statement': return '#4ade80';
      default: return '#908fa0';
    }
  }

  getCriticalityClass(): string {
    const c = this.item()?.criticality || 0;
    if (c >= 8) return 'bg-red-500/20 text-red-400';
    if (c >= 6) return 'bg-orange-500/20 text-orange-400';
    if (c >= 4) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-green-500/20 text-green-400';
  }

  getCriticalityLabel(): string {
    const c = this.item()?.criticality || 0;
    if (c >= 8) return 'CRITIQUE';
    if (c >= 6) return 'IMPORTANT';
    if (c >= 4) return 'MOYEN';
    return 'FAIBLE';
  }

  getCriticalityBarClass(): string {
    const c = this.item()?.criticality || 0;
    if (c >= 8) return 'bg-red-500';
    if (c >= 6) return 'bg-orange-500';
    if (c >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  getSentimentIcon(): string {
    const s = this.item()?.sentiment;
    if (s === 'negative') return '😡';
    if (s === 'positive') return '😊';
    return '😐';
  }

  formatNumber(n: number): string {
    if (!n) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  }
}

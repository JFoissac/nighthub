import { Component, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrumpItem } from '../../models';

@Component({
  selector: 'app-trump-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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

          <!-- Criticality badge + tooltip -->
          <span class="relative inline-flex items-center gap-1 group">
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border cursor-help"
                  [class]="getCriticalityClass()"
                  title="{{ getCriticalityTooltip() }}">
              {{ getCriticalityLabel() }} {{ item()!.criticality }}/10
            </span>
            <span
              class="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-[#2A2A3E] bg-[#16161F] p-2.5 text-[10px] leading-relaxed text-text-secondary opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
            >
              <span class="font-label-caps text-[9px] text-text-muted block mb-1">ÉCHELLE DE CRITICALITÉ</span>
              <span class="flex items-center justify-between gap-2"><span class="text-green-400">● FAIBLE</span><span class="text-text-muted">0 – 3 · routine</span></span>
              <span class="flex items-center justify-between gap-2"><span class="text-yellow-400">● MOYEN</span><span class="text-text-muted">4 – 5 · notable</span></span>
              <span class="flex items-center justify-between gap-2"><span class="text-orange-400">● IMPORTANT</span><span class="text-text-muted">6 – 7 · répercussions</span></span>
              <span class="flex items-center justify-between gap-2"><span class="text-red-400">● CRITIQUE</span><span class="text-text-muted">8 – 10 · alerte mondiale</span></span>
            </span>
          </span>

          @if (item()!.isBreaking) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 bg-warning/20 text-warning border border-warning/30 rounded animate-pulse">BREAKING</span>
          }
          @if (item()!.aiRelevance) {
            <span class="relative inline-flex items-center gap-1 group">
              <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border cursor-help border-fuchsia-500/40 text-fuchsia-400"
                    title="{{ getAiTooltip() }}">
                IA {{ item()!.aiRelevance }}/10
              </span>
              <span
                class="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-[#2A2A3E] bg-[#16161F] p-2.5 text-[10px] leading-relaxed text-text-secondary opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100"
              >
                <span class="font-label-caps text-[9px] text-text-muted block mb-1">PERTINENCE IA</span>
                @if (item()!.aiSummary) {
                  <span class="block">{{ item()!.aiSummary }}</span>
                }
                @if (item()!.aiReason) {
                  <span class="block mt-1 text-text-muted">{{ item()!.aiReason }}</span>
                }
              </span>
            </span>
          }
          @if (item()!.isImageOnly) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-[#2A2A3E] text-text-muted">
              {{ item()!.mediaType === 'video' ? '🎬 VIDÉO' : '📷 PHOTO' }}
            </span>
          }
        </div>

        @if (firstMediaUrl() && !mediaError()) {
          <div class="mb-2 rounded-lg overflow-hidden border border-[#1E1E2E] bg-black/40">
            <img
              [src]="firstMediaUrl()"
              alt="Média du post"
              loading="lazy"
              class="w-full max-h-44 object-cover"
              (error)="onMediaError()"
            >
          </div>
          @if (item()!.content) {
            <p class="text-[13px] text-text-secondary leading-snug line-clamp-3 mb-1">{{ item()!.content }}</p>
          }
        } @else {
          <p class="text-[13px] text-text-secondary leading-snug line-clamp-3">{{ item()!.content }}</p>
        }

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

  mediaError = signal(false);

  firstMediaUrl(): string | null {
    const urls = this.item()?.mediaUrls;
    if (!urls) return null;
    const first = urls.split('\n')[0].trim();
    return first || null;
  }

  onMediaError() {
    this.mediaError.set(true);
  }

  getAiTooltip(): string {
    const i = this.item();
    if (!i) return '';
    const parts: string[] = [];
    if (i.aiSummary) parts.push(i.aiSummary);
    if (i.aiReason) parts.push(i.aiReason);
    if (parts.length === 0) return `Pertinence IA ${i.aiRelevance ?? 0}/10`;
    return parts.join(' — ');
  }

  getCriticalityTooltip(): string {
    const c = this.item()?.criticality ?? 0;
    if (c >= 8) return 'CRITIQUE (8-10) : alerte mondiale — guerre, frappes, choc économique majeur';
    if (c >= 6) return 'IMPORTANT (6-7) : répercussions notables — politique, économie, sécurité';
    if (c >= 4) return 'MOYEN (4-5) : notable — sujet d\u2019actualité suivi';
    return 'FAIBLE (0-3) : routine — communication courante';
  }

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
    switch (this.getSeverityLevel()) {
      case 'critical': return 'bg-red-500/20 text-red-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-green-500/20 text-green-400';
    }
  }

  getCriticalityLabel(): string {
    return this.item()?.severityLabel || this.getSeverityFallback().label;
  }

  getCriticalityBarClass(): string {
    switch (this.getSeverityLevel()) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
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

  private getSeverityLevel(): 'low' | 'medium' | 'high' | 'critical' {
    return this.item()?.severityLevel || this.getSeverityFallback().level;
  }

  private getSeverityFallback(): { level: 'low' | 'medium' | 'high' | 'critical'; label: 'FAIBLE' | 'MOYEN' | 'IMPORTANT' | 'CRITIQUE' } {
    const c = this.item()?.criticality || 0;
    if (c >= 8) return { level: 'critical', label: 'CRITIQUE' };
    if (c >= 6) return { level: 'high', label: 'IMPORTANT' };
    if (c >= 4) return { level: 'medium', label: 'MOYEN' };
    return { level: 'low', label: 'FAIBLE' };
  }
}

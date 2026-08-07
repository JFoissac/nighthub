import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrumpNewsItem } from '../../models';

@Component({
  selector: 'app-trump-news-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (item()) {
      <a [href]="item()!.url" target="_blank" rel="noopener"
         class="block px-4 py-3 border-b border-[#1E1E2E]/50 last:border-0 hover:bg-white/[0.03] transition-colors"
         [class.border-l-2]="item()!.isBreaking"
         [class.border-l-warning]="item()!.isBreaking">
        <div class="flex items-start gap-2 flex-wrap mb-1">
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-[#2A2A3E] text-text-muted uppercase">
            {{ item()!.source }}
          </span>

          @if (item()!.isBreaking) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded animate-pulse">
              BREAKING TV/NEWS
            </span>
          }

          @if (relevanceScore() > 0) {
            <span class="relative inline-flex items-center gap-1 group font-label-caps text-[9px] px-1.5 py-0.5 rounded border cursor-help"
                  [class]="item()!.isBreaking
                    ? 'border-red-500/40 text-red-400'
                    : 'border-fuchsia-500/40 text-fuchsia-400'"
                  title="{{ aiReason() }}">
              {{ item()!.aiRelevance ? 'IA' : 'SCORE' }} {{ relevanceScore() }}/10
              <span
                class="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-60 rounded-lg border border-[#2A2A3E] bg-[#16161F] p-2.5 text-[10px] leading-relaxed text-text-secondary opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                <span class="font-label-caps text-[9px] text-text-muted block mb-1">PERTINENCE</span>
                @if (item()!.aiSummary) {
                  <span class="block">{{ item()!.aiSummary }}</span>
                }
                @if (item()!.aiReason) {
                  <span class="block mt-1 text-text-muted">{{ item()!.aiReason }}</span>
                }
                @if (!item()!.aiSummary && !item()!.aiReason) {
                  <span class="block text-text-muted">Score heuristique (mots-clés) — IA non configurée.</span>
                }
              </span>
            </span>
          }
        </div>

        <p class="text-[13px] text-text-secondary leading-snug line-clamp-2">{{ item()!.title }}</p>
        @if (item()!.summary) {
          <p class="text-[11px] text-text-muted leading-snug line-clamp-2 mt-0.5">{{ item()!.summary }}</p>
        }

        <div class="flex items-center gap-3 mt-1.5">
          <span class="font-label-caps text-[9px] text-text-muted">{{ item()!.pubDate | date:'MMM d HH:mm' }}</span>
          @if (item()!.matchedKeywords) {
            <span class="font-label-caps text-[9px] text-text-muted truncate"># {{ item()!.matchedKeywords }}</span>
          }
        </div>
      </a>
    }
  `,
})
export class TrumpNewsCardComponent {
  item = input<TrumpNewsItem | null>(null);

  relevanceScore(): number {
    return this.item()?.aiRelevance || this.item()?.criticality || 0;
  }

  aiReason(): string {
    const i = this.item();
    if (!i) return '';
    if (i.aiReason) return i.aiReason;
    if (i.aiSummary) return i.aiSummary;
    return `Score de criticité ${i.criticality}/10 basé sur les mots-clés`;
  }
}

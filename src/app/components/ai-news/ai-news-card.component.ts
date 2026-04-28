import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiNewsItem } from '../../models';

@Component({
  selector: 'app-ai-news-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (item()) {
      <div role="button" tabindex="0"
         (click)="articleClick.emit($event)"
         (keydown.enter)="articleClick.emit($event)"
         class="block px-4 py-3 border-b border-[#1E1E2E]/50 last:border-0 hover:bg-white/[0.03] transition-colors group cursor-pointer">
        <h3 class="text-[13px] font-medium text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {{ item()!.title }}
        </h3>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-primary/30 text-primary/80"
                [style.borderColor]="getSourceColor() + '50'"
                [style.color]="getSourceColor()">
            {{ item()!.source | uppercase }}
          </span>
          @if (item()!.isNew) {
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-secondary/30 text-secondary/80">NEW</span>
          }
          <span class="font-label-caps text-[9px] text-text-muted">{{ item()!.pubDate | date:'MMM d' }}</span>
          @if (item()!.categories) {
            <span class="font-label-caps text-[8px] text-text-muted/60 truncate max-w-[120px]" [title]="item()!.categories!">
              · {{ item()!.categories }}
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class AiNewsCardComponent {
  item = input<AiNewsItem | null>(null);
  articleClick = output<Event>();

  getSourceColor(): string {
    switch (this.item()?.source) {
      case 'anthropic': return '#fbbf24';
      case 'openai':    return '#34d399';
      case 'kimi':      return '#a78bfa';
      case 'next.ink':  return '#60a5fa';
      case 'numerama':  return '#f472b6';
      case 'frandroid': return '#22c55e';
      default:          return '#c0c1ff';
    }
  }
}

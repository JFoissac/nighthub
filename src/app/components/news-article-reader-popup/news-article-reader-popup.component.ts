import { Component, HostListener, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ExternalLink, X } from 'lucide-angular';
import { ExtractedNewsArticle } from '../../services/api.service';

@Component({
  selector: 'app-news-article-reader-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div role="presentation" class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
         (click)="onBackdropClick($event)">
      <div
           role="dialog"
           aria-modal="true"
           class="w-full max-w-4xl max-h-[90vh] bg-[#0e0e13] border border-[#1E1E2E] rounded shadow-2xl flex flex-col">
        <div class="px-4 py-3 border-b border-[#1E1E2E] bg-[#131318]/60 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-[14px] font-medium text-text-primary leading-snug">{{ article().title }}</h2>
            <p class="font-label-caps text-[10px] text-primary mt-1">{{ article().source | uppercase }}</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              [href]="article().url"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-[#1E1E2E]"
              aria-label="Open original article"
              (click)="$event.stopPropagation()">
              <lucide-icon aria-hidden="true" [name]="ExternalLink" size="16"></lucide-icon>
            </a>
            <button
              type="button"
              (click)="closed.emit()"
              class="p-1.5 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-[#1E1E2E]"
              aria-label="Close article reader"
            >
              <lucide-icon aria-hidden="true" [name]="X" size="16"></lucide-icon>
            </button>
          </div>
        </div>
        <div class="overflow-y-auto p-6 overscroll-contain">
          @if (article().contentHtml) {
            <div class="text-[15px] leading-8 text-text-primary max-w-2xl mx-auto space-y-4 [&_p]:mt-4 [&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:mt-5 [&_h3]:mb-1 [&_li]:ml-4 [&_a]:text-primary [&_a]:underline [&_a]:hover:opacity-80" [innerHTML]="article().contentHtml"></div>
          } @else {
            @for (paragraph of (article().content || '').split('\n\n'); track paragraph) {
              <p class="text-[15px] leading-8 text-text-primary max-w-2xl mx-auto">{{ paragraph }}</p>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class NewsArticleReaderPopupComponent {
  readonly ExternalLink = ExternalLink;
  readonly X = X;

  article = input.required<ExtractedNewsArticle>();
  closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }
}

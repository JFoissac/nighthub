import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';

/** Dispositions d'état vide : centré, aligné à gauche, ou ligne horizontale avec action. */
export type EmptyStateLayout = 'center' | 'start' | 'row';

/**
 * État vide réutilisable : titre, description et action facultative.
 * Remplace les blocs « NO DATA / NO ARTICLES / ... » dupliqués dans les sections.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (layout()) {
      @case ('start') {
        <p class="font-label-caps text-[10px] text-text-muted p-4">{{ title() }}</p>
      }
      @case ('row') {
        <div class="neo-glass rounded p-6 flex items-center gap-4">
          <p class="font-label-caps text-[10px] text-text-muted">{{ title() }}</p>
          @if (actionLabel()) {
            <button (click)="action.emit()" class="font-label-caps text-[10px] text-primary underline">
              {{ actionLabel() }}
            </button>
          }
        </div>
      }
      @default {
        <div class="p-6 text-center">
          <p class="font-label-caps text-[10px] text-text-muted mb-2">{{ title() }}</p>
          @if (description()) {
            <p class="text-[10px] text-text-muted opacity-60">{{ description() }}</p>
          }
          @if (actionLabel()) {
            <button (click)="action.emit()" class="font-label-caps text-[10px] text-primary underline">
              {{ actionLabel() }}
            </button>
          }
        </div>
      }
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly actionLabel = input<string>();
  readonly layout = input<EmptyStateLayout>('center');
  readonly action = output<void>();
}

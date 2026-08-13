import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';

/** Variantes de skeleton correspondant aux blocs de chargement des sections. */
export type SkeletonVariant = 'card' | 'post' | 'thumbnail' | 'row' | 'text';

/**
 * Squelette de chargement réutilisable (barres animées `animate-pulse`).
 * Remplace les blocs de placeholder dupliqués dans les sections du dashboard.
 */
@Component({
  selector: 'app-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (variant()) {
      @case ('text') {
        <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
      }
      @case ('row') {
        <div class="neo-glass rounded p-6 flex items-center gap-4">
          <div class="flex-1 space-y-3">
            <div class="h-3 w-28 rounded bg-[#1E1E2E]/60 animate-pulse"></div>
            <div class="h-3 w-40 rounded bg-[#1E1E2E]/40 animate-pulse"></div>
          </div>
          <div class="h-8 w-24 rounded bg-[#1E1E2E]/50 animate-pulse"></div>
        </div>
      }
      @case ('card') {
        <div class="space-y-3 p-4">
          @for (i of placeholders(); track i) {
            <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/40 p-4 space-y-3 animate-pulse">
              <div class="h-3 w-20 rounded bg-[#1E1E2E]/70"></div>
              <div class="h-4 w-11/12 rounded bg-[#1E1E2E]/60"></div>
              <div class="h-3 w-4/5 rounded bg-[#1E1E2E]/50"></div>
              <div class="flex gap-2 pt-1">
                <div class="h-5 w-14 rounded-full bg-[#1E1E2E]/40"></div>
                <div class="h-5 w-20 rounded-full bg-[#1E1E2E]/30"></div>
              </div>
            </div>
          }
        </div>
      }
      @case ('post') {
        <div class="space-y-3 p-4">
          @for (i of placeholders(); track i) {
            <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/40 p-4 animate-pulse space-y-3">
              <div class="flex items-center justify-between">
                <div class="h-3 w-28 rounded bg-[#1E1E2E]/70"></div>
                <div class="h-5 w-16 rounded-full bg-[#1E1E2E]/40"></div>
              </div>
              <div class="h-3 w-11/12 rounded bg-[#1E1E2E]/60"></div>
              <div class="h-3 w-4/5 rounded bg-[#1E1E2E]/50"></div>
            </div>
          }
        </div>
      }
      @case ('thumbnail') {
        <div class="space-y-3">
          @for (i of placeholders(); track i) {
            <div class="rounded-xl border border-[#1E1E2E] bg-[#131318]/50 p-3 flex gap-3 animate-pulse">
              <div class="w-32 h-[72px] rounded-lg bg-[#1E1E2E]/70 shrink-0"></div>
              <div class="flex-1 space-y-2 pt-1">
                <div class="h-3 w-5/6 rounded bg-[#1E1E2E]/70"></div>
                <div class="h-3 w-2/3 rounded bg-[#1E1E2E]/50"></div>
                <div class="h-2 w-24 rounded bg-[#1E1E2E]/40"></div>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
})
export class SkeletonComponent {
  readonly variant = input<SkeletonVariant>('card');
  readonly count = input(3);

  readonly placeholders = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}

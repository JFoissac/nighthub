import { Component, input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card-glow rounded-xl border transition-all duration-200 hover:border-primary/50 hover:scale-[1.02] p-4"
         [class.opacity-50]="loading()">
      @if (loading()) {
        <div class="animate-pulse">
          <div class="h-4 bg-surface rounded w-3/4 mb-2"></div>
          <div class="h-3 bg-surface rounded w-1/2"></div>
        </div>
      } @else {
        <ng-content></ng-content>
      }
    </div>
  `,
})
export class CardComponent {
  loading = input(false);
}
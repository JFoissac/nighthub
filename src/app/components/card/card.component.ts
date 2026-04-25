import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-glow rounded-xl border transition-all duration-200 hover:border-primary/50 hover:scale-[1.02] p-4"
         [class.opacity-50]="loading()">
      <div class="animate-pulse" *ngIf="loading()">
        <div class="h-4 bg-surface rounded w-3/4 mb-2"></div>
        <div class="h-3 bg-surface rounded w-1/2"></div>
      </div>
      <ng-content *ngIf="!loading()"></ng-content>
    </div>
  `,
})
export class CardComponent {
  loading = input(false);
}
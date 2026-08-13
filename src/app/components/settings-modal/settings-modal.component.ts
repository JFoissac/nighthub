import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div role="presentation" class="absolute inset-0 bg-black/60 backdrop-blur-sm" (click)="closed.emit()"></div>

      <div class="relative bg-surface border border-border rounded-2xl w-full max-w-xl shadow-2xl">
        <div class="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 class="font-headline text-xl font-bold text-text-primary">Configuration NightHub</h2>
          <button (click)="closed.emit()" class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary" aria-label="Fermer">
            <lucide-icon [name]="X" size="20"></lucide-icon>
          </button>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-sm text-text-secondary">
            Cette version de NightHub sépare maintenant les réglages en deux popups distincts.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button class="px-4 py-3 rounded-lg border border-border bg-background text-left hover:bg-border/40 transition-colors" type="button">
              <div class="font-semibold text-text-primary">Options</div>
              <div class="text-xs text-text-muted">Theme, météo, Trump Watch, intervals.</div>
            </button>
            <button class="px-4 py-3 rounded-lg border border-border bg-background text-left hover:bg-border/40 transition-colors" type="button">
              <div class="font-semibold text-text-primary">Sources</div>
              <div class="text-xs text-text-muted">Twitch, YouTube, RSS et remap YouTube.</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SettingsModalComponent {
  readonly X = X;

  @Output() closed = new EventEmitter<void>();
}

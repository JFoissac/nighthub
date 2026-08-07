import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, UserPreferences } from '../../services/api.service';

@Component({
  selector: 'app-settings-options',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div class="relative bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" role="dialog" aria-labelledby="options-title">
        <div class="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 id="options-title" class="font-headline text-xl font-bold text-text-primary flex items-center gap-2">
            <span class="text-xl">⚙️</span>
            Configuration NightHub
          </h2>
          <button (click)="close.emit()" class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary" aria-label="Fermer">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="px-6 py-5 space-y-6">
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🎨</span>
              <h3 class="font-headline font-semibold text-text-primary">Theme</h3>
            </div>

            <div class="flex items-center justify-between gap-4">
              <div>
                <label class="text-sm text-text-primary">OLED True Black</label>
                <p class="text-xs text-text-muted">Background #000000 for OLED screens</p>
              </div>
              <button
                (click)="themeOled = !themeOled"
                class="relative w-12 h-6 rounded-full transition-colors"
                [class.bg-primary]="themeOled"
                [class.bg-[#1E1E2E]]="!themeOled"
                role="switch"
                [attr.aria-checked]="themeOled"
              >
                <span
                  class="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform"
                  [class.left-1]="!themeOled"
                  [class.left-7]="themeOled"
                ></span>
              </button>
            </div>
          </section>

          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🌤️</span>
              <h3 class="font-headline font-semibold text-text-primary">Météo</h3>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">Ville</label>
              <input
                type="text"
                [(ngModel)]="prefs.weatherCity"
                placeholder="Caen"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </section>

          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🦅</span>
              <h3 class="font-headline font-semibold text-text-primary">Trump Watch</h3>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">
                Criticité minimum à afficher :
                <span class="font-mono font-bold text-text-primary ml-1">{{ prefs.trumpMinCriticality }}</span>
                <span class="text-xs ml-1">/ 10</span>
              </label>
              <input
                type="range"
                [(ngModel)]="prefs.trumpMinCriticality"
                min="0"
                max="10"
                step="1"
                class="w-full accent-red-500"
              />
              <div class="flex justify-between text-xs text-text-secondary">
                <span>0 - Tout afficher</span>
                <span>5 - Important</span>
                <span>10 - Critique only</span>
              </div>
            </div>
          </section>

          <section class="space-y-4">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🔄</span>
              <h3 class="font-headline font-semibold text-text-primary">Rafraîchissement par bloc</h3>
            </div>

            @for (item of refreshItems(); track item.key) {
              <div class="space-y-1.5">
                <div class="flex justify-between items-center">
                  <label class="text-sm text-text-secondary">{{ item.label }}</label>
                  <span class="font-mono text-xs text-primary">{{ formatInterval(item.value) }}</span>
                </div>
                <input
                  type="range"
                  [ngModel]="item.value"
                  (ngModelChange)="setRefreshInterval(item.key, $event)"
                  min="5"
                  max="360"
                  step="5"
                  class="w-full accent-primary"
                />
              </div>
            }

            <div class="flex justify-between text-xs text-text-secondary pt-1">
              <span>5 min</span>
              <span>3h</span>
              <span>6h</span>
            </div>
          </section>
        </div>

        <div class="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            (click)="saveAndClose()"
            [disabled]="isSaving()"
            class="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {{ isSaving() ? 'Sauvegarde...' : 'Sauvegarder' }}
          </button>
          <button
            (click)="close.emit()"
            class="px-6 py-3 bg-background text-text-secondary rounded-lg font-medium hover:bg-border/50 transition-colors border border-border"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SettingsOptionsComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private apiService = inject(ApiService);

  isSaving = signal(false);

  prefs: UserPreferences = {
    weatherCity: 'Caen',
    twitchFollows: '',
    twitchUsername: '',
    youtubeChannels: '',
    youtubeChannelIds: '',
    trumpMinCriticality: 0,
    customRssFeeds: '',
    refreshInterval: 30,
    themeOledBlack: false,
    marketRefreshInterval: 60,
    trumpRefreshInterval: 144,
    newsRefreshInterval: 30,
    streamsRefreshInterval: 5,
    youtubeRefreshInterval: 30,
  };

  themeOled = false;

  ngOnInit() {
    this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        this.prefs = { ...this.prefs, ...prefs };
        this.themeOled = prefs.themeOledBlack ?? false;
      },
    });
  }

  refreshItems() {
    return [
      { key: 'marketRefreshInterval' as const, label: '📈 Markets Live', value: this.prefs.marketRefreshInterval },
      { key: 'trumpRefreshInterval' as const, label: '🦅 Trump Watch', value: this.prefs.trumpRefreshInterval },
      { key: 'newsRefreshInterval' as const, label: '📰 AI Blog', value: this.prefs.newsRefreshInterval },
      { key: 'streamsRefreshInterval' as const, label: '📺 Live Streams', value: this.prefs.streamsRefreshInterval },
      { key: 'youtubeRefreshInterval' as const, label: '▶️ YouTube', value: this.prefs.youtubeRefreshInterval },
    ];
  }

  setRefreshInterval(key: keyof Pick<UserPreferences, 'marketRefreshInterval' | 'trumpRefreshInterval' | 'newsRefreshInterval' | 'streamsRefreshInterval' | 'youtubeRefreshInterval'>, value: number) {
    this.prefs[key] = Number(value);
  }

  saveAndClose() {
    this.isSaving.set(true);
    this.apiService.savePreferences({ ...this.prefs, themeOledBlack: this.themeOled }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  formatInterval(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m} min`;
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }
}

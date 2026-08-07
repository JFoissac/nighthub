import { Component, OnInit, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, UserPreferences } from '../../services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-background p-6">
      <div class="max-w-2xl mx-auto">
        <div class="flex items-center gap-4 mb-8">
          <a routerLink="/" class="p-2 rounded-lg hover:bg-surface transition-colors">
            <svg class="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </a>
          <h1 class="font-headline text-2xl font-bold text-text-primary">Paramètres</h1>
        </div>

        @if (saved()) {
          <div class="mb-4 px-4 py-3 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium">
            ✓ Préférences sauvegardées avec succès
          </div>
        }

        <!-- Channel Config -->
        <section class="bg-surface rounded-xl border border-border p-6 mb-6">
          <h2 class="font-headline text-lg font-semibold text-text-primary mb-1">Configuration des services</h2>
          <p class="text-text-secondary text-sm mb-6">Configurez vos chaînes et profils sans OAuth.</p>

          <div class="space-y-6">

            <!-- Twitch -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">🎮</span>
                <label class="font-medium text-text-primary">Twitch — Chaînes à suivre</label>
              </div>
              <p class="text-xs text-text-secondary">Noms de chaînes séparés par des virgules. Le statut live est vérifié automatiquement.</p>
              <input
                type="text"
                [(ngModel)]="prefs.twitchFollows"
                placeholder="ex: shroud, xqc, pokimane, kamet0"
                class="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:border-primary focus:outline-none font-mono text-sm"
              />
              @if (prefs.twitchFollows) {
                <div class="flex flex-wrap gap-2 mt-1">
                  @for (ch of twitchList(); track ch) {
                    <span class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs font-mono">{{ ch }}</span>
                  }
                </div>
              }
            </div>

            <!-- YouTube -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">📺</span>
                <label class="font-medium text-text-primary">YouTube — Chaînes à suivre</label>
              </div>
              <p class="text-xs text-text-secondary">Handles (@nom) séparés par des virgules. Les vidéos récentes sont récupérées via le flux RSS public.</p>
              <input
                type="text"
                [(ngModel)]="prefs.youtubeChannels"
                placeholder="ex: @MrBeast, @Fireship, @t3dotgg"
                class="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:border-primary focus:outline-none font-mono text-sm"
              />
              @if (prefs.youtubeChannels) {
                <div class="flex flex-wrap gap-2 mt-1">
                  @for (ch of youtubeList(); track ch) {
                    <span class="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-xs font-mono">{{ ch }}</span>
                  }
                </div>
              }
            </div>

            <!-- Weather city -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">🌤</span>
                <label class="font-medium text-text-primary">Météo — Ville</label>
              </div>
              <input
                type="text"
                [(ngModel)]="prefs.weatherCity"
                placeholder="Caen"
                class="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:border-primary focus:outline-none text-sm"
              />
            </div>

            <button
              (click)="savePreferences()"
              [disabled]="isSaving()"
              class="w-full px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
            >
              {{ isSaving() ? 'Sauvegarde...' : 'Sauvegarder les préférences' }}
            </button>
          </div>
        </section>

        <!-- Data Management -->
        <section class="bg-surface rounded-xl border border-border p-6">
          <h2 class="font-headline text-lg font-semibold text-text-primary mb-4">Gestion des données</h2>

          <div class="space-y-4">
            <button
              (click)="refreshAll()"
              [disabled]="isRefreshing()"
              class="w-full px-4 py-3 bg-warning/20 text-warning rounded-lg font-medium hover:bg-warning/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span class="{{ isRefreshing() ? 'animate-spin' : '' }}">🔄</span>
              {{ isRefreshing() ? 'Rafraîchissement...' : 'Rafraîchir toutes les données' }}
            </button>

            @if (lastRefresh) {
              <p class="text-xs text-text-secondary text-center">
                Dernière mise à jour: {{ lastRefresh | date:'short' }}
              </p>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  private apiService = inject(ApiService);

  isSaving = signal(false);
  isRefreshing = signal(false);
  saved = signal(false);
  lastRefresh: Date | null = null;

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

  twitchList = signal<string[]>([]);
  youtubeList = signal<string[]>([]);

  ngOnInit() {
    this.loadPreferences();
  }

  loadPreferences() {
    this.apiService.getPreferences().subscribe({
      next: (p) => {
        this.prefs = { ...this.prefs, ...p };
        this.updateLists();
      },
      error: () => {}
    });
  }

  updateLists() {
    this.twitchList.set(
      this.prefs.twitchFollows.split(',').map(s => s.trim()).filter(Boolean)
    );
    this.youtubeList.set(
      this.prefs.youtubeChannels.split(',').map(s => s.trim()).filter(Boolean)
    );
  }

  savePreferences() {
    this.isSaving.set(true);
    this.saved.set(false);
    this.apiService.savePreferences(this.prefs).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.set(true);
        this.updateLists();
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => {
        this.isSaving.set(false);
      }
    });
  }

  refreshAll() {
    this.isRefreshing.set(true);
    this.apiService.refreshAll().subscribe({
      next: () => {
        this.isRefreshing.set(false);
        this.lastRefresh = new Date();
      },
      error: () => {
        this.isRefreshing.set(false);
      }
    });
  }
}

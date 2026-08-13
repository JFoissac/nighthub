import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, X, Upload } from 'lucide-angular';
import { ApiService, YoutubeChannelCandidate, YoutubeRemapReport, UserPreferences } from '../../services/api.service';

@Component({
  selector: 'app-settings-sources',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div role="presentation" class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <div class="relative bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" role="dialog" aria-labelledby="sources-title">
        <div class="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 id="sources-title" class="font-headline text-xl font-bold text-text-primary flex items-center gap-2">
            <span class="text-xl">📡</span>
            Sources & Chaînes
          </h2>
          <button (click)="closed.emit()" class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary" aria-label="Fermer">
            <lucide-icon [name]="X" size="20"></lucide-icon>
          </button>
        </div>

        <div class="px-6 py-5 space-y-6">
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">📺</span>
              <h3 class="font-headline font-semibold text-text-primary">Twitch</h3>
              @if (twitchChannelCount() > 0) {
                <span class="ml-auto text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                  {{ twitchChannelCount() }} chaînes
                </span>
              }
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              @if (twitchConnected()) {
                <span class="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ✓ Compte Twitch connecté — lecture sans pub (Turbo)
                </span>
                <button
                  (click)="disconnectTwitch()"
                  class="px-3 py-1 text-xs rounded bg-background border border-border text-text-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
                >
                  Se déconnecter
                </button>
              } @else {
                <button
                  (click)="connectTwitch()"
                  class="px-3 py-1 text-xs rounded bg-purple-600/20 text-purple-300 border border-purple-600/30 hover:bg-purple-600/30 transition-colors"
                >
                  Se connecter à Twitch (supprime les pubs avec Turbo)
                </button>
              }
            </div>
            <div class="space-y-2">
              <label for="twitch-paste-list" class="text-sm text-text-secondary">Coller une liste de chaînes (une par ligne ou séparées par des virgules)</label>
              <textarea
                id="twitch-paste-list"
                [(ngModel)]="twitchPasteList"
                placeholder="kamet0&#10;squeezie&#10;gotaga&#10;zerator"
                rows="3"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-purple-500 focus:outline-none resize-none"
              ></textarea>
              <button
                (click)="importTwitchFromPaste()"
                [disabled]="!twitchPasteList.trim()"
                class="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-600/30 transition-colors disabled:opacity-30 border border-purple-600/30"
              >
                Ajouter ces chaînes
              </button>
            </div>
            @if (twitchList().length > 0) {
              <div class="space-y-1">
                <p class="text-xs text-text-secondary">Chaînes suivies :</p>
                <div class="flex flex-wrap gap-1.5">
                  @for (ch of twitchList(); track ch) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/15 text-purple-300 rounded text-xs font-mono">
                      {{ ch }}
                      <button (click)="removeTwitchChannel(ch)" class="hover:text-red-400 transition-colors ml-0.5">&times;</button>
                    </span>
                  }
                </div>
              </div>
            }
          </section>

          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">▶️</span>
              <h3 class="font-headline font-semibold text-text-primary">YouTube</h3>
              @if (youtubeChannelCount() > 0) {
                <span class="ml-auto text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {{ youtubeChannelCount() }} chaînes
                </span>
              }
            </div>
            <div class="space-y-2">
              <label for="youtube-paste-list" class="text-sm text-text-secondary">Ajouter des chaînes YouTube (handles &#64;nom, une par ligne ou virgules)</label>
              <textarea
                id="youtube-paste-list"
                [(ngModel)]="youtubePasteList"
                placeholder="&#64;MrBeast&#10;&#64;Fireship&#10;&#64;t3dotgg&#10;&#64;LexFridman"
                rows="3"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-red-500 focus:outline-none resize-none"
              ></textarea>
              <div class="flex gap-2 flex-wrap">
                <button
                  (click)="importYoutubeFromPaste()"
                  [disabled]="!youtubePasteList.trim() || isImportingYoutube()"
                  class="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors disabled:opacity-30 border border-red-600/30"
                >
                  {{ isImportingYoutube() ? 'Import...' : 'Ajouter ces chaînes' }}
                </button>
                <label class="px-4 py-2 bg-amber-600/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-600/30 transition-colors border border-amber-600/30 cursor-pointer flex items-center gap-1.5"
                       title="Importer depuis Google Takeout (abonnements.csv)">
                  <lucide-icon [name]="Upload" size="14"></lucide-icon>
                  Google Takeout CSV
                  <input type="file" accept=".csv" class="hidden" (change)="onTakeoutFile($event)">
                </label>
                <button
                  (click)="openYoutubeRemapAdmin()"
                  class="px-4 py-2 bg-slate-600/20 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600/30 transition-colors border border-slate-600/30"
                >
                  Admin remap
                </button>
              </div>
              @if (takeoutImportResult()) {
                <p class="text-xs text-green-400">{{ takeoutImportResult() }}</p>
              }
            </div>

            @if (youtubeList().length > 0) {
              <div class="space-y-1">
                <p class="text-xs text-text-secondary">Chaînes suivies :</p>
                <div class="flex flex-wrap gap-1.5">
                  @for (ch of youtubeList(); track ch) {
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/15 text-red-300 rounded text-xs font-mono">
                      {{ ch }}
                      <button (click)="removeYoutubeChannel(ch)" class="hover:text-red-400 transition-colors ml-0.5">&times;</button>
                    </span>
                  }
                </div>
              </div>
            }
          </section>

          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">📡</span>
              <h3 class="font-headline font-semibold text-text-primary">Flux RSS personnalisés</h3>
            </div>
            <div class="space-y-2">
              <label for="custom-rss-feeds" class="text-sm text-text-secondary">URLs de flux RSS à suivre (un par ligne)</label>
              <textarea
                id="custom-rss-feeds"
                [(ngModel)]="prefs.customRssFeeds"
                placeholder="https://example.com/feed.xml&#10;https://blog.example.com/rss"
                rows="3"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-amber-500 focus:outline-none resize-none"
              ></textarea>
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
            (click)="closed.emit()"
            class="px-6 py-3 bg-background text-text-secondary rounded-lg font-medium hover:bg-border/50 transition-colors border border-border"
          >
            Annuler
          </button>
        </div>
      </div>

      @if (showYoutubeRemapAdmin()) {
        <div role="presentation" class="absolute inset-0 z-20 flex items-center justify-center p-4" (click)="onAdminBackdropClick($event)">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div class="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl">
            <div class="sticky top-0 z-10 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
              <h3 class="font-headline text-lg font-semibold text-text-primary">Admin Remap YouTube</h3>
              <button
                (click)="showYoutubeRemapAdmin.set(false)"
                class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary"
                aria-label="Fermer"
              >
                <lucide-icon [name]="X" size="20"></lucide-icon>
              </button>
            </div>

            <div class="p-5 space-y-4">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  (click)="refreshYoutubeRemapReport()"
                  [disabled]="youtubeRemapLoading()"
                  class="px-3 py-1.5 rounded-md bg-red-600/20 text-red-300 border border-red-600/30 text-xs hover:bg-red-600/30 disabled:opacity-40"
                >
                  {{ youtubeRemapLoading() ? 'Refresh...' : 'Rafraîchir diagnostic' }}
                </button>
                @if (youtubeRemapReport()) {
                  <span class="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                    {{ youtubeRemapSuspiciousCount() }} suspects
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded bg-slate-500/15 text-slate-300">
                    {{ youtubeRemapReport()!.handles.length }} handles
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded bg-slate-500/15 text-slate-300">
                    {{ youtubeRemapReport()!.storedChannelIds.length }} IDs stockés
                  </span>
                }
              </div>

              @if (youtubeRemapMessage()) {
                <p class="text-xs text-green-400">{{ youtubeRemapMessage() }}</p>
              }
              @if (youtubeRemapError()) {
                <p class="text-xs text-red-400">{{ youtubeRemapError() }}</p>
              }

              @if (youtubeRemapReport()) {
                <section class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h4 class="text-sm font-semibold text-text-primary">Handles suivis</h4>
                    <span class="text-[11px] text-text-muted">
                      Généré le {{ youtubeRemapReport()!.generatedAt | date:'dd/MM HH:mm:ss' }}
                    </span>
                  </div>
                  <div class="space-y-1">
                    @for (row of youtubeRemapReport()!.handles; track row.handle) {
                      <div class="rounded-lg border border-border/70 px-3 py-2 bg-background/40">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-sm font-mono text-text-primary">{{ row.handle }}</span>
                          @if (row.status === 'ok') {
                            <span class="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-300">OK</span>
                          }
                          @if (row.status === 'missingStoredId') {
                            <span class="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">ID manquant</span>
                          }
                          @if (row.status === 'unresolved') {
                            <span class="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300">Non résolu</span>
                          }
                        </div>
                        <div class="text-xs font-mono text-text-secondary mt-1 break-all">
                          ID résolu: {{ row.resolvedChannelId || '—' }}
                        </div>
                        <button
                          (click)="setRemapHandle(row.handle)"
                          class="mt-2 text-[11px] px-2 py-1 rounded bg-slate-500/20 text-slate-300 hover:bg-slate-500/30"
                        >
                          Utiliser ce handle
                        </button>
                      </div>
                    }
                  </div>
                </section>

                <section class="space-y-2 pt-2 border-t border-border/50">
                  <h4 class="text-sm font-semibold text-text-primary">Rechercher des candidats</h4>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="youtubeRemapSearchQuery"
                      placeholder="@handle ou nom de chaîne"
                      class="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-red-500 focus:outline-none"
                    />
                    <button
                      (click)="searchYoutubeRemapCandidates()"
                      [disabled]="youtubeRemapSearchLoading()"
                      class="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors disabled:opacity-40 border border-red-600/30"
                    >
                      {{ youtubeRemapSearchLoading() ? 'Recherche...' : 'Rechercher' }}
                    </button>
                  </div>
                  <div class="space-y-1">
                    @for (candidate of youtubeRemapCandidates(); track candidate.channelId) {
                      <button
                        (click)="selectYoutubeCandidate(candidate)"
                        class="w-full text-left rounded-lg border border-border/70 px-3 py-2 bg-background/40 hover:bg-background/70 transition-colors"
                      >
                        <div class="text-sm text-text-primary">
                          {{ candidate.title }}
                          @if (candidate.handle) {
                            <span class="font-mono text-text-secondary ml-1">{{ candidate.handle }}</span>
                          }
                        </div>
                        <div class="text-[11px] font-mono text-text-muted break-all">{{ candidate.channelId }}</div>
                      </button>
                    }
                  </div>
                </section>

                <section class="space-y-2 pt-2 border-t border-border/50">
                  <h4 class="text-sm font-semibold text-text-primary">Forcer un remap manuel</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      type="text"
                      [(ngModel)]="youtubeRemapHandleInput"
                      placeholder="@handle (ex: @SylvainLyve)"
                      class="px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-red-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      [(ngModel)]="youtubeRemapChannelIdInput"
                      placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
                      class="px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-red-500 focus:outline-none"
                    />
                  </div>
                  <button
                    (click)="applyYoutubeRemap()"
                    [disabled]="youtubeRemapApplyLoading()"
                    class="px-4 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors disabled:opacity-40 border border-red-600/30"
                  >
                    {{ youtubeRemapApplyLoading() ? 'Application...' : 'Appliquer le remap' }}
                  </button>
                </section>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SettingsSourcesComponent implements OnInit {
  readonly X = X;
  readonly Upload = Upload;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private apiService = inject(ApiService);

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

  twitchPasteList = '';
  youtubePasteList = '';

  isSaving = signal(false);
  isImportingYoutube = signal(false);
  twitchList = signal<string[]>([]);
  youtubeList = signal<string[]>([]);
  twitchChannelCount = signal(0);
  youtubeChannelCount = signal(0);
  takeoutImportResult = signal<string | null>(null);
  showYoutubeRemapAdmin = signal(false);
  youtubeRemapReport = signal<YoutubeRemapReport | null>(null);
  youtubeRemapLoading = signal(false);
  youtubeRemapSearchLoading = signal(false);
  youtubeRemapApplyLoading = signal(false);
  youtubeRemapCandidates = signal<YoutubeChannelCandidate[]>([]);
  youtubeRemapMessage = signal<string | null>(null);
  youtubeRemapError = signal<string | null>(null);
  youtubeRemapSearchQuery = '';
  youtubeRemapHandleInput = '';
  youtubeRemapChannelIdInput = '';

  twitchConnected = signal(false);

  youtubeRemapSuspiciousCount = signal(0);

  ngOnInit() {
    this.loadPreferences();
    this.checkTwitchAuth();
  }

  checkTwitchAuth() {
    this.apiService.getAuthStatus().subscribe({
      next: (status) => this.twitchConnected.set(!!status.twitch),
      error: () => this.twitchConnected.set(false),
    });
  }

  connectTwitch() {
    this.apiService.connectTwitch();
    // Re-check after the OAuth popup round-trip (user may take a while).
    window.setTimeout(() => this.checkTwitchAuth(), 5000);
    window.setTimeout(() => this.checkTwitchAuth(), 15000);
  }

  disconnectTwitch() {
    this.apiService.logout('twitch').subscribe({
      next: () => this.twitchConnected.set(false),
      error: () => this.twitchConnected.set(false),
    });
  }

  loadPreferences() {
    this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        this.prefs = { ...this.prefs, ...prefs };
        this.updateLists();
      },
    });
  }

  updateLists() {
    const twitch = this.prefs.twitchFollows.split(',').map((s) => s.trim()).filter(Boolean);
    const youtube = this.prefs.youtubeChannels.split(',').map((s) => s.trim()).filter(Boolean);
    this.twitchList.set(twitch);
    this.youtubeList.set(youtube);
    this.twitchChannelCount.set(twitch.length);
    this.youtubeChannelCount.set(youtube.length);
  }

  importTwitchFromPaste() {
    const raw = this.twitchPasteList.trim();
    if (!raw) return;
    const channels = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!channels.length) return;

    this.apiService.importTwitchList(channels).subscribe({
      next: () => {
        this.twitchPasteList = '';
        this.loadPreferences();
      },
    });
  }

  importYoutubeFromPaste() {
    const raw = this.youtubePasteList.trim();
    if (!raw) return;
    const channels = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!channels.length) return;

    this.isImportingYoutube.set(true);
    this.apiService.importYoutubeList(channels).subscribe({
      next: () => {
        this.isImportingYoutube.set(false);
        this.youtubePasteList = '';
        this.loadPreferences();
      },
      error: () => this.isImportingYoutube.set(false),
    });
  }

  onTakeoutFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const channels = csv.trim().split('\n').slice(1).map(line => {
        const parts = line.split(',');
        return { channelId: parts[0]?.trim(), title: parts[2]?.trim() || '' };
      }).filter(c => c.channelId && /^UC[a-zA-Z0-9_-]{22}$/.test(c.channelId));

      if (channels.length === 0) {
        this.takeoutImportResult.set('Aucune chaîne valide trouvée dans le fichier CSV.');
        return;
      }

      this.apiService.importYoutubeTakeout(channels).subscribe({
        next: (r) => {
          this.takeoutImportResult.set(`${r.imported} chaînes importées (total: ${r.total})`);
          this.loadPreferences();
        },
        error: () => this.takeoutImportResult.set('Erreur lors de l\'import Takeout'),
      });
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  removeTwitchChannel(channel: string) {
    this.prefs.twitchFollows = this.twitchList().filter((c) => c !== channel).join(',');
    this.updateLists();
  }

  removeYoutubeChannel(channel: string) {
    this.prefs.youtubeChannels = this.youtubeList().filter((c) => c !== channel).join(',');
    this.updateLists();
  }

  openYoutubeRemapAdmin() {
    this.showYoutubeRemapAdmin.set(true);
    this.youtubeRemapMessage.set(null);
    this.youtubeRemapError.set(null);
    this.refreshYoutubeRemapReport();
  }

  refreshYoutubeRemapReport() {
    this.youtubeRemapLoading.set(true);
    this.apiService.getYoutubeRemapReport().subscribe({
      next: (report) => {
        this.youtubeRemapLoading.set(false);
        this.youtubeRemapReport.set(report);
        const firstProblem = report.handles.find((h) => h.status !== 'ok');
        if (firstProblem && !this.youtubeRemapHandleInput) {
          this.youtubeRemapHandleInput = firstProblem.handle;
        }
        const suspicious = report.handles.filter((h) => h.status !== 'ok').length + report.orphanChannelIds.length;
        this.youtubeRemapSuspiciousCount.set(suspicious);
      },
      error: () => {
        this.youtubeRemapLoading.set(false);
        this.youtubeRemapError.set('Impossible de charger le diagnostic YouTube.');
      },
    });
  }

  searchYoutubeRemapCandidates() {
    const query = this.youtubeRemapSearchQuery.trim();
    if (query.length < 2) return;
    this.youtubeRemapSearchLoading.set(true);
    this.youtubeRemapError.set(null);
    this.apiService.searchYoutubeChannels(query).subscribe({
      next: ({ candidates }) => {
        this.youtubeRemapSearchLoading.set(false);
        this.youtubeRemapCandidates.set(candidates || []);
      },
      error: () => {
        this.youtubeRemapSearchLoading.set(false);
        this.youtubeRemapError.set('Recherche de chaîne impossible pour le moment.');
      },
    });
  }

  setRemapHandle(handle: string) {
    this.youtubeRemapHandleInput = handle;
    this.youtubeRemapMessage.set(null);
    this.youtubeRemapError.set(null);
  }

  selectYoutubeCandidate(candidate: YoutubeChannelCandidate) {
    this.youtubeRemapChannelIdInput = candidate.channelId;
    if (candidate.handle && !this.youtubeRemapHandleInput) {
      this.youtubeRemapHandleInput = candidate.handle;
    }
    this.youtubeRemapMessage.set(`ID sélectionné: ${candidate.channelId}`);
  }

  applyYoutubeRemap() {
    const handle = this.youtubeRemapHandleInput.trim();
    const channelId = this.youtubeRemapChannelIdInput.trim();
    if (!handle || !channelId) {
      this.youtubeRemapError.set('Renseigne un handle et un channel ID.');
      return;
    }

    this.youtubeRemapApplyLoading.set(true);
    this.youtubeRemapMessage.set(null);
    this.youtubeRemapError.set(null);
    this.apiService.remapYoutubeChannel(handle, channelId).subscribe({
      next: () => {
        this.youtubeRemapApplyLoading.set(false);
        this.youtubeRemapMessage.set(`Remap appliqué: ${handle} → ${channelId}`);
        this.refreshYoutubeRemapReport();
        this.loadPreferences();
      },
      error: (err) => {
        this.youtubeRemapApplyLoading.set(false);
        this.youtubeRemapError.set(err?.message || 'Erreur pendant le remap.');
      },
    });
  }

  saveAndClose() {
    this.isSaving.set(true);
    this.apiService.savePreferences({ ...this.prefs }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.closed.emit();
    }
  }

  onAdminBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('absolute') || target.classList.contains('inset-0')) {
      this.showYoutubeRemapAdmin.set(false);
    }
  }
}

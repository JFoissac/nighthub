import { Component, EventEmitter, OnInit, Output, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ApiService,
  UserPreferences,
  TwitterAccountStat,
  YoutubeRemapReport,
  YoutubeChannelCandidate,
} from '../../services/api.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

      <!-- Modal -->
      <div class="relative bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" role="dialog" aria-labelledby="settings-title">
        <!-- Header -->
        <div class="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 id="settings-title" class="font-headline text-xl font-bold text-text-primary flex items-center gap-2">
            <svg class="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Configuration NightHub
          </h2>
          <button (click)="close.emit()" class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary" aria-label="Fermer">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-5 space-y-6">
          @if (savedSignal()) {
            <div class="px-4 py-3 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-sm font-medium animate-pulse">
              Preferences sauvegardees
            </div>
          }

          <!-- Theme Section -->
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🎨</span>
              <h3 class="font-headline font-semibold text-text-primary">Theme</h3>
            </div>

            <div class="flex items-center justify-between">
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

          <!-- Twitch Section -->
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

            <!-- Paste list -->
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">Coller une liste de chaînes (une par ligne ou séparées par des virgules)</label>
              <textarea
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

            <!-- Current follows preview -->
            @if (prefs.twitchFollows) {
              <div class="space-y-1">
                <label class="text-xs text-text-secondary">Chaînes suivies :</label>
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

          <!-- YouTube Section -->
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
              <label class="text-sm text-text-secondary">Ajouter des chaînes YouTube (handles &#64;nom, une par ligne ou virgules)</label>
              <textarea
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
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17,8 12,3 7,8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
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

            @if (prefs.youtubeChannels) {
              <div class="space-y-1">
                <label class="text-xs text-text-secondary">Chaînes suivies :</label>
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

          <!-- Twitter / X Section -->
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🐦</span>
              <h3 class="font-headline font-semibold text-text-primary">X / Twitter</h3>
              @if (twitterAccountCount() > 0) {
                <span class="ml-auto text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  {{ twitterAccountCount() }} comptes
                </span>
              }
            </div>
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">Comptes à surveiller (avec ou sans @, un par ligne ou séparés par des virgules)</label>
              <textarea
                [(ngModel)]="twitterPasteList"
                placeholder="&#64;elonmusk&#10;&#64;sama&#10;&#64;ylecun"
                rows="3"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-blue-500 focus:outline-none resize-none"
              ></textarea>
              <button
                (click)="addTwitterAccounts()"
                [disabled]="!twitterPasteList.trim()"
                class="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-30 border border-blue-600/30"
              >
                Ajouter ces comptes
              </button>
            </div>
            @if (twitterList().length > 0) {
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-text-secondary">Comptes surveillés :</label>
                  @if (inactiveCount() > 0) {
                    <button
                      (click)="removeInactiveAccounts()"
                      class="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                    >
                      Supprimer les {{ inactiveCount() }} inactifs
                    </button>
                  }
                </div>
                <div class="flex flex-wrap gap-1.5">
                  @for (acc of twitterList(); track acc) {
                    @let stat = twitterStats().get(acc.toLowerCase());
                    @let isInactive = stat?.inactive ?? false;
                    <span
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
                      [class]="isInactive ? 'bg-red-500/15 text-red-300 border border-red-500/30' : 'bg-blue-500/15 text-blue-300'"
                      [title]="stat?.lastSeen ? ('Vu : ' + (stat!.lastSeen | date:'dd/MM/yy')) : 'Jamais vu'"
                    >
                      &#64;{{ acc }}
                      @if (isInactive) {
                        <span class="text-red-400/70 text-[9px]">inactif</span>
                      }
                      <button (click)="removeTwitterAccount(acc)" class="hover:text-red-400 transition-colors ml-0.5">&times;</button>
                    </span>
                  }
                </div>
                @if (twitterStats().size > 0) {
                  <p class="text-[10px] text-text-muted mt-1">Rouge = aucun tweet depuis 30 jours</p>
                }
              </div>
            }
          </section>

          <!-- Trump Watch Section -->
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

          <!-- Weather Section -->
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

          <!-- Custom RSS Feeds Section -->
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">📡</span>
              <h3 class="font-headline font-semibold text-text-primary">Flux RSS personnalisés</h3>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">URLs de flux RSS à suivre (un par ligne)</label>
              <textarea
                [(ngModel)]="prefs.customRssFeeds"
                placeholder="https://example.com/feed.xml&#10;https://blog.example.com/rss"
                rows="3"
                class="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm font-mono focus:border-amber-500 focus:outline-none resize-none"
              ></textarea>
            </div>
          </section>

          <!-- Refresh interval -->
          <section class="space-y-3">
            <div class="flex items-center gap-2 pb-2 border-b border-border/50">
              <span class="text-lg">🔄</span>
              <h3 class="font-headline font-semibold text-text-primary">Rafraîchissement</h3>
            </div>
            <div class="space-y-2">
              <label class="text-sm text-text-secondary">
                Intervalle : <span class="font-mono font-bold text-text-primary">{{ prefs.refreshInterval }} min</span>
              </label>
              <input
                type="range"
                [(ngModel)]="prefs.refreshInterval"
                min="5"
                max="60"
                step="5"
                class="w-full accent-primary"
              />
              <div class="flex justify-between text-xs text-text-secondary">
                <span>5 min</span>
                <span>30 min</span>
                <span>60 min</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button
            (click)="saveAndClose()"
            [disabled]="isSaving()"
            class="flex-1 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/80 transition-colors disabled:opacity-50"
          >
            {{ isSaving() ? 'Sauvegarde...' : 'Sauvegarder et fermer' }}
          </button>
          <button
            (click)="close.emit()"
            class="px-6 py-3 bg-background text-text-secondary rounded-lg font-medium hover:bg-border/50 transition-colors border border-border"
          >
            Annuler
          </button>
	        </div>
	      </div>

	      @if (showYoutubeRemapAdmin()) {
	        <div class="absolute inset-0 z-20 flex items-center justify-center p-4" (click)="onAdminBackdropClick($event)">
	          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
	          <div class="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-2xl">
	            <div class="sticky top-0 z-10 bg-surface border-b border-border px-5 py-3 flex items-center justify-between">
	              <h3 class="font-headline text-lg font-semibold text-text-primary">Admin Remap YouTube</h3>
	              <button
	                (click)="showYoutubeRemapAdmin.set(false)"
	                class="p-2 rounded-lg hover:bg-background transition-colors text-text-secondary hover:text-text-primary"
	                aria-label="Fermer"
	              >
	                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
	                  <path d="M18 6L6 18M6 6l12 12"/>
	                </svg>
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
	                        @if (row.lastSeenChannelName || row.lastSeenChannelHandle) {
	                          <div class="text-[11px] text-text-muted mt-1">
	                            Dernier vu: {{ row.lastSeenChannelName || 'Chaîne inconnue' }}
	                            @if (row.lastSeenChannelHandle) {
	                              <span class="font-mono ml-1">{{ row.lastSeenChannelHandle }}</span>
	                            }
	                          </div>
	                        }
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

	                @if (youtubeRemapReport()!.orphanChannelIds.length > 0) {
	                  <section class="space-y-2">
	                    <h4 class="text-sm font-semibold text-text-primary">IDs orphelins / suspects</h4>
	                    <div class="space-y-1">
	                      @for (orphan of youtubeRemapReport()!.orphanChannelIds; track orphan.channelId) {
	                        <div class="rounded-lg border border-amber-500/30 px-3 py-2 bg-amber-500/5">
	                          <div class="text-xs font-mono text-amber-300 break-all">{{ orphan.channelId }}</div>
	                          @if (orphan.lastSeenChannelName || orphan.lastSeenChannelHandle) {
	                            <div class="text-[11px] text-amber-200/80 mt-1">
	                              Dernier vu: {{ orphan.lastSeenChannelName || 'Chaîne inconnue' }}
	                              @if (orphan.lastSeenChannelHandle) {
	                                <span class="font-mono ml-1">{{ orphan.lastSeenChannelHandle }}</span>
	                              }
	                            </div>
	                          }
	                        </div>
	                      }
	                    </div>
	                  </section>
	                }
	              }

	              <section class="space-y-2 pt-2 border-t border-border/50">
	                <h4 class="text-sm font-semibold text-text-primary">Chercher le bon channel ID</h4>
	                <div class="flex flex-wrap gap-2">
	                  <input
	                    type="text"
	                    [(ngModel)]="youtubeRemapSearchQuery"
	                    placeholder="Nom de chaîne (ex: SylvainLyve)"
	                    class="flex-1 min-w-[240px] px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm focus:border-red-500 focus:outline-none"
	                  />
	                  <button
	                    (click)="searchYoutubeRemapCandidates()"
	                    [disabled]="youtubeRemapSearchLoading() || youtubeRemapSearchQuery.trim().length < 2"
	                    class="px-4 py-2 bg-blue-600/20 text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-40 border border-blue-600/30"
	                  >
	                    {{ youtubeRemapSearchLoading() ? 'Recherche...' : 'Rechercher' }}
	                  </button>
	                </div>
	                <a
	                  href="https://commentpicker.com/youtube-channel-id.php"
	                  target="_blank"
	                  rel="noopener noreferrer"
	                  class="inline-block text-[11px] text-blue-300 hover:text-blue-200"
	                >
	                  Ouvrir un finder externe de YouTube channel ID
	                </a>
	                @if (youtubeRemapCandidates().length > 0) {
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
	                }
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
	            </div>
	          </div>
	        </div>
	      }
	    </div>
	  `,
})
export class SettingsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private apiService = inject(ApiService);

  prefs: UserPreferences = {
    weatherCity: 'Caen',
    twitchFollows: '',
    twitchUsername: '',
    youtubeChannels: '',
    youtubeChannelIds: '',
    twitterUsername: '',
    twitterAccounts: '',
    trumpMinCriticality: 0,
    customRssFeeds: '',
    refreshInterval: 30,
    themeOledBlack: false,
  };

  themeOled = false;

  twitchPasteList = '';
  youtubePasteList = '';
  twitterPasteList = '';

  isSaving = signal(false);
  isImportingTwitch = signal(false);
  isImportingYoutube = signal(false);
  twitchList = signal<string[]>([]);
  youtubeList = signal<string[]>([]);
  twitterList = signal<string[]>([]);
  twitchChannelCount = signal(0);
  youtubeChannelCount = signal(0);
  twitterAccountCount = signal(0);
  savedSignal = signal(false);
  takeoutImportResult = signal<string | null>(null);
  twitterStats = signal<Map<string, TwitterAccountStat>>(new Map());
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

  youtubeRemapSuspiciousCount = computed(() => {
    const report = this.youtubeRemapReport();
    if (!report) return 0;
    const handleIssues = report.handles.filter((h) => h.status !== 'ok').length;
    return handleIssues + report.orphanChannelIds.length;
  });

  inactiveCount = computed(() => {
    const stats = this.twitterStats();
    return this.twitterList().filter(acc => stats.get(acc.toLowerCase())?.inactive).length;
  });

  // Alias for template
  get savedValue() { return this.savedSignal; }

  ngOnInit() {
    this.loadPreferences();
    this.loadTwitterStats();
  }

  loadTwitterStats() {
    this.apiService.getTwitterAccountStats().subscribe({
      next: (stats) => {
        const map = new Map<string, TwitterAccountStat>();
        for (const s of stats) map.set(s.handle.toLowerCase(), s);
        this.twitterStats.set(map);
      },
    });
  }

  loadPreferences() {
    this.apiService.getPreferences().subscribe({
      next: (p) => {
        this.prefs = { ...this.prefs, ...p };
        this.themeOled = p.themeOledBlack ?? false;
        this.updateLists();
      },
    });
  }

  updateLists() {
    const twitch = this.prefs.twitchFollows.split(',').map(s => s.trim()).filter(Boolean);
    const youtube = this.prefs.youtubeChannels.split(',').map(s => s.trim()).filter(Boolean);
    const twitter = this.prefs.twitterAccounts.split(',').map(s => s.trim()).filter(Boolean);
    this.twitchList.set(twitch);
    this.youtubeList.set(youtube);
    this.twitterList.set(twitter);
    this.twitchChannelCount.set(twitch.length);
    this.youtubeChannelCount.set(youtube.length);
    this.twitterAccountCount.set(twitter.length);
  }

  importTwitchFromPaste() {
    const raw = this.twitchPasteList.trim();
    if (!raw) return;

    const channels = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (channels.length === 0) return;

    this.isImportingTwitch.set(true);
    this.apiService.importTwitchList(channels).subscribe({
      next: (result) => {
        this.isImportingTwitch.set(false);
        this.twitchPasteList = '';
        this.loadPreferences();
      },
      error: () => {
        this.isImportingTwitch.set(false);
      },
    });
  }

  importYoutubeFromPaste() {
    const raw = this.youtubePasteList.trim();
    if (!raw) return;

    const channels = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (channels.length === 0) return;

    this.isImportingYoutube.set(true);
    this.apiService.importYoutubeList(channels).subscribe({
      next: () => {
        this.isImportingYoutube.set(false);
        this.youtubePasteList = '';
        this.loadPreferences();
      },
      error: () => {
        this.isImportingYoutube.set(false);
      },
    });
  }

  addTwitterAccounts() {
    const raw = this.twitterPasteList.trim();
    if (!raw) return;
    const newAccounts = raw.split(/[\n,]+/).map(s => s.trim().replace(/^@/, '')).filter(Boolean);
    const existing = this.twitterList();
    const merged = [...new Set([...existing, ...newAccounts])];
    this.prefs.twitterAccounts = merged.join(',');
    this.twitterPasteList = '';
    this.updateLists();
  }

  onTakeoutFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      // Skip header line, columns: Channel Id, Channel Url, Channel Title
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
    // Reset input so same file can be re-selected
    (event.target as HTMLInputElement).value = '';
  }

  removeInactiveAccounts() {
    const stats = this.twitterStats();
    const active = this.twitterList().filter(acc => !stats.get(acc.toLowerCase())?.inactive);
    this.prefs.twitterAccounts = active.join(',');
    this.updateLists();
  }

  removeTwitterAccount(account: string) {
    const list = this.twitterList().filter(a => a !== account);
    this.prefs.twitterAccounts = list.join(',');
    this.updateLists();
  }

  removeTwitchChannel(channel: string) {
    const list = this.twitchList().filter(c => c !== channel);
    this.prefs.twitchFollows = list.join(',');
    this.updateLists();
  }

  removeYoutubeChannel(channel: string) {
    const list = this.youtubeList().filter(c => c !== channel);
    this.prefs.youtubeChannels = list.join(',');
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
      },
      error: (err) => {
        const message = String(err?.message || '');
        if (message.includes('404')) {
          this.buildFallbackRemapReport();
          return;
        }
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
      error: (err) => {
        const message = String(err?.message || '');
        if (message.includes('404')) {
          this.searchYoutubeFallback(query);
          return;
        }
        this.youtubeRemapSearchLoading.set(false);
        this.youtubeRemapError.set('Recherche de chaîne impossible pour le moment.');
      },
    });
  }

  private buildFallbackRemapReport() {
    forkJoin({
      prefs: this.apiService.getPreferences().pipe(catchError(() => of(this.prefs))),
      videos: this.apiService.getVideos(100).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ prefs, videos }) => {
        const handles = (prefs.youtubeChannels || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((s: string) => s.startsWith('@') ? s : `@${s}`);
        const storedChannelIds = (prefs.youtubeChannelIds || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter((id: string) => /^UC[a-zA-Z0-9_-]{22}$/.test(id));

        const latestByHandle = new Map<string, any>();
        for (const video of videos as any[]) {
          const handle = typeof video?.channelHandle === 'string' && video.channelHandle.startsWith('@')
            ? video.channelHandle
            : '';
          if (!handle) continue;
          if (!latestByHandle.has(handle)) {
            latestByHandle.set(handle, video);
          }
        }

        const rows = handles.map((handle: string) => {
          const snapshot = latestByHandle.get(handle);
          const resolvedChannelId = /^UC[a-zA-Z0-9_-]{22}$/.test(snapshot?.channelId || '')
            ? snapshot.channelId
            : null;
          const storedMatch = Boolean(resolvedChannelId && storedChannelIds.includes(resolvedChannelId));
          return {
            handle,
            resolvedChannelId,
            status: resolvedChannelId ? (storedMatch ? 'ok' : 'missingStoredId') : 'unresolved',
            storedMatch,
            lastSeenChannelName: snapshot?.channelName || '',
            lastSeenChannelHandle: handle,
          } as any;
        });

        const resolvedSet = new Set(rows.map((r: any) => r.resolvedChannelId).filter(Boolean));
        const orphanChannelIds = storedChannelIds
          .filter((channelId: string) => !resolvedSet.has(channelId))
          .map((channelId: string) => ({
            channelId,
            lastSeenChannelName: '',
            lastSeenChannelHandle: '',
          }));

        this.youtubeRemapReport.set({
          generatedAt: new Date().toISOString(),
          handles: rows as any,
          orphanChannelIds,
          storedChannelIds,
          resolvedChannelIds: [...resolvedSet] as string[],
        });
        this.youtubeRemapLoading.set(false);
        this.youtubeRemapMessage.set('Mode fallback local actif (backend remap API indisponible).');
        this.youtubeRemapError.set(null);
      },
      error: () => {
        this.youtubeRemapLoading.set(false);
        this.youtubeRemapError.set('Impossible de charger le diagnostic YouTube.');
      },
    });
  }

  private searchYoutubeFallback(query: string) {
    const q = query.toLowerCase();
    const handles = this.youtubeList()
      .map((h) => h.startsWith('@') ? h : `@${h}`)
      .filter((h) => h.toLowerCase().includes(q))
      .slice(0, 10)
      .map((handle) => ({
        channelId: '',
        title: handle,
        handle,
        url: `https://www.youtube.com/${handle}`,
        source: 'cache' as const,
      }));
    this.youtubeRemapCandidates.set(handles);
    this.youtubeRemapSearchLoading.set(false);
    this.youtubeRemapMessage.set('Recherche fallback locale active.');
    this.youtubeRemapError.set(null);
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
      next: (result) => {
        this.youtubeRemapApplyLoading.set(false);
        this.youtubeRemapMessage.set(`Remap appliqué: ${result.handle} → ${result.channelId}`);
        this.refreshYoutubeRemapReport();
        this.loadPreferences();
      },
      error: (err) => {
        this.youtubeRemapApplyLoading.set(false);
        const msg = err?.message || 'Erreur pendant le remap.';
        this.youtubeRemapError.set(msg);
      },
    });
  }

  saveAndClose() {
    this.isSaving.set(true);
    this.apiService.savePreferences({ ...this.prefs, themeOledBlack: this.themeOled } as any).subscribe({
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

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }

  onAdminBackdropClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('absolute') || target.classList.contains('inset-0')) {
      this.showYoutubeRemapAdmin.set(false);
    }
  }
}

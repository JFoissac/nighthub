import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { StreamCardComponent } from '../../components/stream/stream-card.component';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { VideoCardComponent } from '../../components/video/video-card.component';
import { VideoPlayerPopupComponent } from '../../components/video/video-player-popup.component';
import { VideoPlayerPanelComponent } from '../../components/video/video-player-panel.component';
import { TweetCardComponent } from '../../components/tweet/tweet-card.component';
import { AiNewsCardComponent } from '../../components/ai-news/ai-news-card.component';
import { TrumpCardComponent } from '../../components/trump/trump-card.component';
import { SettingsModalComponent } from '../../components/settings-modal/settings-modal.component';
import { WeatherPopupComponent } from '../../components/weather/weather-popup.component';
import { ApiService, DashboardData } from '../../services/api.service';
import { TwitchStream, YoutubeVideo } from '../../models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    StreamCardComponent,
    StreamPlayerPanelComponent,
    VideoCardComponent,
    VideoPlayerPopupComponent,
    VideoPlayerPanelComponent,
    TweetCardComponent,
    AiNewsCardComponent,
    TrumpCardComponent,
    SettingsModalComponent,
    WeatherPopupComponent,
  ],
  template: `
    <div class="min-h-screen bg-background">
      <app-header
        (refresh)="refreshAll()"
        (openSettings)="showSettings.set(true)"
        (openWeather)="showWeather.set(true)"
        [weatherTemp]="dashboardData()?.weather?.days?.[0]?.temp ?? null"
        [weatherCity]="dashboardData()?.weather?.city || ''"
        [weatherCondition]="dashboardData()?.weather?.days?.[0]?.condition || ''"
        [streamCount]="dashboardData()?.streams?.length || 0"
        [videoCount]="dashboardData()?.videos?.length || 0"
        [newsCount]="dashboardData()?.news?.length || 0"
        [tweetCount]="dashboardData()?.tweets?.length || 0"
      ></app-header>

      @if (showWeather()) {
        <app-weather-popup
          [forecast]="dashboardData()?.weather || null"
          (close)="showWeather.set(false)"
        ></app-weather-popup>
      }

      @if (showSettings()) {
        <app-settings-modal
          (close)="showSettings.set(false)"
          (saved)="onSettingsSaved()"
        ></app-settings-modal>
      }

      @if (selectedVideo()) {
        <app-video-player-popup
          [video]="selectedVideo()!"
          (close)="selectedVideo.set(null)"
          (openPanel)="selectedVideo.set(null); panelVideo.set($event)"
        ></app-video-player-popup>
      }

      @if (panelVideo()) {
        <app-video-player-panel
          [video]="panelVideo()!"
          (close)="panelVideo.set(null)"
        ></app-video-player-panel>
      }

      <!-- Push-panel flex layout: main shrinks when stream panel is open -->
      <div class="flex pt-12 min-h-screen">
        <main class="flex-1 min-w-0">
        <div class="p-6 max-w-screen-2xl mx-auto">
        @if (isSyncing()) {
          <div class="mb-4 px-4 py-2 neo-glass rounded flex items-center gap-3 border border-primary/30">
            <span class="status-pulse"></span>
            <span class="font-label-caps text-[10px] text-primary">INITIAL SYNC IN PROGRESS — DATA LOADING IN BACKGROUND...</span>
            <span class="font-label-caps text-[9px] text-text-muted ml-auto">AUTO-REFRESH IN ~15S</span>
          </div>
        }
        @if (isLoading()) {
          <div class="flex flex-col items-center justify-center py-20 gap-2">
            <span class="font-label-caps text-[11px] text-text-muted animate-pulse">{{ loadingStatus() }}</span>
          </div>
        } @else {

          <!-- Top Row: Twitter (5-col) + YouTube (7-col) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">

            <!-- Latest @X / Twitter -->
            <section class="lg:col-span-5 neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 0ms">
              <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
                <div class="flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">LATEST @X / TWITTER</span>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 380px">
                @for (tweet of dashboardData()?.tweets || []; track tweet.id || $index) {
                  <app-tweet-card [tweet]="tweet"></app-tweet-card>
                }
                @if (!dashboardData()?.tweets?.length) {
                  <div class="p-6 text-center">
                    <p class="font-label-caps text-[10px] text-text-muted mb-2">NO FEEDS CONFIGURED</p>
                    <button (click)="showSettings.set(true)" class="font-label-caps text-[10px] text-primary underline">CONFIGURE</button>
                  </div>
                }
              </div>
            </section>

            <!-- YouTube Recaps -->
            <section class="lg:col-span-7 neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 50ms">
              <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
                <div class="flex items-center gap-2">
                  <svg class="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">YOUTUBE RECAPS</span>
                </div>
              </div>
              <div class="flex-1 p-4 space-y-4 overflow-y-auto" style="max-height: 380px">
                @for (video of dashboardData()?.videos || []; track video.id || $index) {
                  <app-video-card [video]="video" (select)="selectedVideo.set($event)"></app-video-card>
                }
                @if (!dashboardData()?.videos?.length) {
                  <div class="text-center py-6">
                    <p class="font-label-caps text-[10px] text-text-muted mb-2">NO CHANNELS CONFIGURED</p>
                    <button (click)="showSettings.set(true)" class="font-label-caps text-[10px] text-primary underline">CONFIGURE</button>
                  </div>
                }
              </div>
            </section>
          </div>

          <!-- Twitch Live Streams — full-width horizontal carousel -->
          <section class="mb-5 fade-in" style="animation-delay: 100ms">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TWITCH LIVE STREAMS</span>
              </div>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              @for (stream of dashboardData()?.streams || []; track stream.twitchId || stream.id || $index) {
                <app-stream-card [stream]="stream" (select)="selectedStream.set($event)"></app-stream-card>
              }
              @if (!dashboardData()?.streams?.length) {
                <div class="neo-glass rounded p-6 flex items-center gap-4">
                  <p class="font-label-caps text-[10px] text-text-muted">NO STREAMS LIVE —</p>
                  <button (click)="showSettings.set(true)" class="font-label-caps text-[10px] text-primary underline">CONFIGURE CHANNELS</button>
                </div>
              }
            </div>
          </section>

          <!-- Bottom Row: AI Blog (6-col) + Trump Watch (6-col) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">

            <!-- AI Blog -->
            <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 150ms">
              <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
                <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">AI BLOG</span>
                <span class="font-label-caps text-[9px] text-text-muted">ANTHROPIC · OPENAI · KIMI · RSS</span>
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 500px">
                @for (item of dashboardData()?.news || []; track item.id || $index) {
                  <app-ai-news-card [item]="item"></app-ai-news-card>
                }
                @if (!dashboardData()?.news?.length) {
                  <p class="font-label-caps text-[10px] text-text-muted p-4">NO ARTICLES</p>
                }
              </div>
            </section>

            <!-- Trump Watch -->
            <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 200ms">
              <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
                <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TRUMP WATCH</span>
                <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400">CRITICALITY</span>
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 500px">
                @for (item of dashboardData()?.trump || []; track item.tweetId || item.id || $index) {
                  <app-trump-card [item]="item"></app-trump-card>
                }
                @if (!dashboardData()?.trump?.length) {
                  <p class="font-label-caps text-[10px] text-text-muted p-4">NO DATA</p>
                }
              </div>
            </section>
          </div>
        }
        </div>

        <footer class="text-center py-4 border-t border-[#1E1E2E]">
          <span class="font-label-caps text-[9px] text-text-muted">NIGHTHUB — TERMINAL DASHBOARD</span>
          @if (dashboardData()?.refreshedAt) {
            <span class="block mt-1 font-label-caps text-[9px] text-text-muted">LAST UPDATE: {{ dashboardData()!.refreshedAt | date:'short' }}</span>
          }
        </footer>
        </main>

        @if (selectedStream()) {
          <app-stream-player-panel
            [stream]="selectedStream()!"
            (close)="selectedStream.set(null)"
          ></app-stream-player-panel>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  dashboardData = signal<DashboardData | null>(null);
  isLoading = signal(true);
  isSyncing = signal(false);
  loadingStatus = signal('LOADING DASHBOARD...');
  showSettings = signal(false);
  showWeather = signal(false);
  selectedStream = signal<TwitchStream | null>(null);
  selectedVideo = signal<YoutubeVideo | null>(null);   // popup
  panelVideo = signal<YoutubeVideo | null>(null);       // side panel

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showWeather()) { this.showWeather.set(false); return; }
    if (this.selectedVideo()) { this.selectedVideo.set(null); return; }
    if (this.panelVideo()) { this.panelVideo.set(null); return; }
    if (this.selectedStream()) { this.selectedStream.set(null); }
  }

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.isLoading.set(true);
    this.loadingStatus.set('CONNECTING...');

    this.apiService.getDashboardStream((step: string) => {
      this.loadingStatus.set(step.toUpperCase());
    }).subscribe({
      next: (data) => {
        this.dashboardData.set(data);
        this.isLoading.set(false);

        // If all content sections are empty (first run / cache cleared), trigger background sync
        const isEmpty = !data.videos?.length && !data.tweets?.length && !data.streams?.length;
        if (isEmpty) {
          this.isSyncing.set(true);
          this.apiService.refreshAll().subscribe();
          setTimeout(() => this.loadDashboard(), 15000);
        } else {
          this.isSyncing.set(false);
        }
      },
      error: () => {
        // Fallback to REST if SSE fails
        this.loadingStatus.set('LOADING DASHBOARD...');
        this.apiService.getDashboard().subscribe({
          next: (data) => {
            this.dashboardData.set(data);
            this.isLoading.set(false);
            const isEmpty = !data.videos?.length && !data.tweets?.length && !data.streams?.length;
            if (isEmpty) {
              this.isSyncing.set(true);
              this.apiService.refreshAll().subscribe();
              setTimeout(() => this.loadDashboard(), 15000);
            } else {
              this.isSyncing.set(false);
            }
          },
          error: (err) => {
            console.error('Failed to load dashboard:', err);
            this.isLoading.set(false);
          }
        });
      }
    });
  }

  refreshAll() {
    this.apiService.refreshAll().subscribe({
      next: () => this.loadDashboard(),
      error: (err) => console.error('Failed to refresh:', err)
    });
  }

  onSettingsSaved() {
    // Reload dashboard after settings change
    this.loadDashboard();
  }
}

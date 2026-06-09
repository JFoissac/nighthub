import { Component, OnInit, OnDestroy, signal, inject, HostListener, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { StreamListPopupComponent } from '../../components/stream/stream-list-popup.component';
import { VideoPlayerPopupComponent } from '../../components/video/video-player-popup.component';
import { VideoPlayerPanelComponent } from '../../components/video/video-player-panel.component';
import { SettingsModalComponent } from '../../components/settings-modal/settings-modal.component';
import { WeatherPopupComponent } from '../../components/weather/weather-popup.component';
import { MarketSectionComponent } from '../../components/sections/market-section.component';
import { YoutubeSectionComponent } from '../../components/sections/youtube-section.component';
import { StreamsSectionComponent } from '../../components/sections/streams-section.component';
import { NewsSectionComponent } from '../../components/sections/news-section.component';
import { TrumpSectionComponent } from '../../components/sections/trump-section.component';
import { ApiService, DashboardData } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { TwitchStream, YoutubeVideo } from '../../models';
import { VideosStore } from '../../stores/videos.store';
import { NewsStore } from '../../stores/news.store';
import { TrumpStore } from '../../stores/trump.store';
import { StreamsStore } from '../../stores/streams.store';
import { MarketStore } from '../../stores/market.store';



@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    HeaderComponent,
    StreamPlayerPanelComponent,
    StreamListPopupComponent,
    VideoPlayerPopupComponent,
    VideoPlayerPanelComponent,
    SettingsModalComponent,
    WeatherPopupComponent,
    MarketSectionComponent,
    YoutubeSectionComponent,
    StreamsSectionComponent,
    NewsSectionComponent,
    TrumpSectionComponent,
  ],
  template: `
    <div class="min-h-screen bg-background">
      <app-header
        (refresh)="refreshAll()"
        (openSettings)="showSettings.set(true)"
        (openWeather)="showWeather.set(true)"
        (openStreamList)="showStreamList.set(true)"
        [weatherTemp]="dashboardData()?.weather?.days?.[0]?.temp ?? null"
        [weatherCity]="dashboardData()?.weather?.city || ''"
        [weatherCondition]="dashboardData()?.weather?.days?.[0]?.condition || ''"
        [streamCount]="streamsStore.count()"
        [videoCount]="videosStore.count()"
        [newsCount]="newsStore.count()"
        [tweetCount]="marketStore.count()"
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

      @if (showStreamList()) {
        <app-stream-list-popup
          [streams]="streamsStore.streams()"
          (close)="showStreamList.set(false)"
          (selectStream)="showStreamList.set(false); onStreamSelect($event)"
        ></app-stream-list-popup>
      }

      <div class="flex pt-12 min-h-screen">
        <main class="flex-1 min-w-0">
        <div class="p-6 max-w-screen-2xl mx-auto">
        @if (isSyncing() || isLoading()) {
          <div class="mb-4 px-4 py-2 neo-glass rounded flex items-center gap-3 border border-primary/30">
            <span class="status-pulse"></span>
            <span class="font-label-caps text-[10px] text-primary">{{ isLoading() ? loadingStatus() : 'INITIAL SYNC IN PROGRESS — DATA LOADING IN BACKGROUND...' }}</span>
            <span class="font-label-caps text-[9px] text-text-muted ml-auto">CONNECTING TO NIGHTHUB SERVER</span>
          </div>
        }

        <!-- Top Row: Market (5-col) + YouTube (7-col) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          @if (isLoading()) {
            <div class="neo-glass rounded p-4 skeleton h-[380px]"></div>
            <div class="neo-glass rounded p-4 skeleton h-[380px]"></div>
          } @else {
            <app-market-section></app-market-section>
            <app-youtube-section
              (selectVideo)="selectedVideo.set($event)"
              (openSettings)="showSettings.set(true)"
            ></app-youtube-section>
          }
        </div>

        @if (isLoading()) {
          <div class="neo-glass rounded p-4 skeleton h-[200px] my-5"></div>
        } @else {
          <app-streams-section
            (selectStream)="onStreamSelect($event)"
            (openStreamList)="showStreamList.set(true)"
            (openSettings)="showSettings.set(true)"
          ></app-streams-section>
        }

        <!-- Bottom Row: AI Blog (6-col) + Trump Watch (6-col) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          @if (isLoading()) {
            <div class="neo-glass rounded p-4 skeleton h-[500px]"></div>
            <div class="neo-glass rounded p-4 skeleton h-[500px]"></div>
          } @else {
            <app-news-section
              (feedAdded)="onFeedAdded($event)"
            ></app-news-section>
            <app-trump-section></app-trump-section>
          }
        </div>
        </div>

        <footer class="text-center py-4 border-t border-[#1E1E2E]">
          <span class="font-label-caps text-[9px] text-text-muted">
            NIGHTHUB — TERMINAL DASHBOARD
            @if (isLive()) {
              <span class="ml-2 text-green-400">
                <span class="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse mr-1 align-middle"></span>LIVE
              </span>
            }
          </span>
          @if (dashboardData()?.refreshedAt) {
            <span class="block mt-1 font-label-caps text-[9px] text-text-muted">LAST UPDATE: {{ dashboardData()!.refreshedAt | date:'short' }}</span>
          }
        </footer>
        </main>

        @if (selectedStream()) {
          <app-stream-player-panel
            [stream]="selectedStream()!"
            (close)="closeSelectedStream()"
          ></app-stream-player-panel>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);

  readonly videosStore = inject(VideosStore);
  readonly newsStore = inject(NewsStore);
  readonly trumpStore = inject(TrumpStore);
  readonly streamsStore = inject(StreamsStore);
  readonly marketStore = inject(MarketStore);

  dashboardData = signal<DashboardData | null>(null);
  isLoading = signal(true);
  isSyncing = signal(false);
  isLive = signal(false);
  loadingStatus = signal('LOADING DASHBOARD...');
  showSettings = signal(false);
  showWeather = signal(false);
  showStreamList = signal(false);
  selectedStreamId = signal<string | null>(null);
  selectedStream = signal<TwitchStream | null>(null);
  selectedVideo = signal<YoutubeVideo | null>(null);
  panelVideo = signal<YoutubeVideo | null>(null);

  constructor() {
    effect(() => {
      const _ = this.isLive();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showSettings()) { this.showSettings.set(false); return; }
    if (this.showStreamList()) { this.showStreamList.set(false); return; }
    if (this.showWeather()) { this.showWeather.set(false); return; }
    if (this.selectedVideo()) { this.selectedVideo.set(null); return; }
    if (this.panelVideo()) { this.panelVideo.set(null); return; }
    if (this.selectedStream()) { this.closeSelectedStream(); }
  }

  ngOnInit() {
    this.loadDashboard();
  }

  private weatherRefreshInterval: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.stopStoreAutoRefreshes();
    if (this.weatherRefreshInterval) {
      clearInterval(this.weatherRefreshInterval);
    }
  }

  onStreamSelect(stream: TwitchStream) {
    if (stream.gameName === 'YouTube Live') {
      this.panelVideo.set({
        id: stream.id,
        youtubeId: stream.twitchId,
        title: stream.title,
        thumbnailUrl: stream.thumbnailUrl,
        channelName: stream.channelName,
        channelHandle: stream.channelHandle,
        channelAvatar: stream.channelAvatar,
        duration: 'LIVE',
        views: stream.viewerCount,
        url: stream.url,
        isLive: true,
      } as YoutubeVideo);
    } else {
      this.selectedStreamId.set(stream.id);
      this.selectedStream.update((current) => {
        if (current && current.id === stream.id) {
          return { ...current, ...stream };
        }
        return stream;
      });
    }
  }

  closeSelectedStream() {
    this.selectedStreamId.set(null);
    this.selectedStream.set(null);
  }

  private applyDashboardData(data: DashboardData) {
    this.videosStore.setItems(data.videos || []);
    this.newsStore.setItems(data.news || []);
    this.trumpStore.setItems(data.trump || []);
    this.streamsStore.setItems(data.streams || []);
    this.marketStore.setItems(data.market || []);
    this.reconcileSelectedStream(data.streams || []);
    this.dashboardData.set(data);
    this.isLoading.set(false);
  }

  private reconcileSelectedStream(streams: TwitchStream[]) {
    const selectedId = this.selectedStreamId();
    if (!selectedId || !this.selectedStream()) return;

    const refreshed = streams.find((stream) => stream.id === selectedId);
    if (refreshed) {
      this.selectedStream.update((current) => {
        if (!current || current.id !== selectedId) return refreshed;
        return { ...current, ...refreshed };
      });
      return;
    }

    // Keep the side panel mounted with last known stream when it disappears from refresh.
    this.selectedStream.update((current) => {
      if (!current || current.id !== selectedId) return current;
      return {
        ...current,
        isLive: false,
        viewerCount: 0,
      };
    });
  }

  loadDashboard() {
    if (!this.dashboardData()) {
      this.isLoading.set(true);
    }
    this.loadingStatus.set('CONNECTING...');

    this.apiService.getDashboardStream((step: string) => {
      this.loadingStatus.set(step.toUpperCase());
    }).subscribe({
      next: (data) => {
        this.applyDashboardData(data);
        const isEmpty = !data.videos?.length && !data.streams?.length && !data.news?.length;
        if (isEmpty) {
          this.isSyncing.set(true);
          this.apiService.refreshAll().subscribe();
        } else {
          this.isSyncing.set(false);
        }
        this.startStoreAutoRefreshes();
      },
      error: () => {
        this.loadingStatus.set('LOADING DASHBOARD...');
        this.apiService.getDashboard().subscribe({
          next: (data) => {
            this.applyDashboardData(data);
            const isEmpty = !data.videos?.length && !data.streams?.length && !data.news?.length;
            if (isEmpty) {
              this.isSyncing.set(true);
              this.apiService.refreshAll().subscribe();
            } else {
              this.isSyncing.set(false);
            }
            this.startStoreAutoRefreshes();
          },
          error: () => {
            this.isLoading.set(false);
            this.startStoreAutoRefreshes();
          }
        });
      }
    });
  }

  private startStoreAutoRefreshes() {
    this.stopStoreAutoRefreshes();
    this.isLive.set(true);
    this.marketStore.startAutoRefresh();
    this.trumpStore.startAutoRefresh();
    this.newsStore.startAutoRefresh();
    this.streamsStore.startAutoRefresh();
    this.videosStore.startAutoRefresh();
    this.startWeatherRefresh();
  }

  private stopStoreAutoRefreshes() {
    this.marketStore.stopAutoRefresh();
    this.trumpStore.stopAutoRefresh();
    this.newsStore.stopAutoRefresh();
    this.streamsStore.stopAutoRefresh();
    this.videosStore.stopAutoRefresh();
    this.isLive.set(false);
    if (this.weatherRefreshInterval) {
      clearInterval(this.weatherRefreshInterval);
      this.weatherRefreshInterval = null;
    }
  }

  private startWeatherRefresh() {
    // Refresh weather every 2 minutes (120000ms)
    this.weatherRefreshInterval = setInterval(() => {
      const city = this.dashboardData()?.weather?.city || 'Caen';
      this.apiService.getWeather(city).subscribe({
        next: (weather) => {
          this.dashboardData.update((current) => {
            if (!current) return current;
            return { ...current, weather };
          });
        },
        error: (err) => {
          console.error('Weather refresh failed:', err);
        }
      });
    }, 120000);
  }

  refreshAll() {
    this.apiService.refreshAll().subscribe({
      next: () => this.loadDashboard(),
      error: (err) => console.error('Failed to refresh:', err)
    });
  }

  onSettingsSaved() {
    this.loadDashboard();
    this.startStoreAutoRefreshes();
  }

  onFeedAdded(feedUrl: string) {
    this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        const existing = (prefs.customRssFeeds || '').trim();
        const updated = existing ? `${existing}\n${feedUrl}` : feedUrl;
        this.apiService.savePreferences({ customRssFeeds: updated }).subscribe({
          next: () => {
            this.apiService.refreshNews().subscribe({
              next: () => {
                this.apiService.getNews().subscribe({
                  next: (news) => {
                    this.newsStore.setItems(news || []);
                    this.dashboardData.update((current) => current ? ({ ...current, news: news || [] }) : current);
                  },
                });
              },
            });
          },
        });
      },
    });
  }
}

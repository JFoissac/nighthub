import { Component, OnInit, OnDestroy, signal, inject, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { switchMap } from 'rxjs';
import { HeaderComponent } from '../../components/header/header.component';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { StreamListPopupComponent } from '../../components/stream/stream-list-popup.component';
import { VideoPlayerPopupComponent } from '../../components/video/video-player-popup.component';
import { VideoPlayerPanelComponent } from '../../components/video/video-player-panel.component';
import { SettingsOptionsComponent } from '../../components/settings-modal/settings-options.component';
import { SettingsSourcesComponent } from '../../components/settings-modal/settings-sources.component';
import { WeatherPopupComponent } from '../../components/weather/weather-popup.component';
import { MarketSectionComponent } from '../../components/sections/market-section.component';
import { YoutubeSectionComponent } from '../../components/sections/youtube-section.component';
import { StreamsSectionComponent } from '../../components/sections/streams-section.component';
import { NewsSectionComponent } from '../../components/sections/news-section.component';
import { TrumpSectionComponent } from '../../components/sections/trump-section.component';
import { SkeletonComponent } from '../../components/skeleton/skeleton.component';
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
    SettingsOptionsComponent,
    SettingsSourcesComponent,
    WeatherPopupComponent,
    MarketSectionComponent,
    YoutubeSectionComponent,
    StreamsSectionComponent,
    NewsSectionComponent,
    TrumpSectionComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="min-h-screen bg-background">
      <app-header
        (openOptions)="showOptions.set(true)"
        (openSources)="showSources.set(true)"
        (openWeather)="showWeather.set(true)"
        (openStreamList)="showStreamList.set(true)"
        (openRefresh)="refreshDashboard()"
        [weatherTemp]="dashboardData()?.weather?.days?.[0]?.temp ?? null"
        [weatherCity]="dashboardData()?.weather?.city || ''"
        [weatherCondition]="dashboardData()?.weather?.days?.[0]?.condition || ''"
        [streamCount]="streamsStore.count()"
        [isRefreshing]="isRefreshing()"
        [refreshStatus]="refreshStatus()"
        [lastUpdatedLabel]="lastUpdatedLabel()"
      ></app-header>

      @if (showWeather()) {
        <app-weather-popup
          [forecast]="dashboardData()?.weather || null"
          (closed)="showWeather.set(false)"
        ></app-weather-popup>
      }

      @if (showOptions()) {
        <app-settings-options
          (closed)="showOptions.set(false)"
          (saved)="onSettingsSaved()"
        ></app-settings-options>
      }

      @if (showSources()) {
        <app-settings-sources
          (closed)="showSources.set(false)"
          (saved)="onSettingsSaved()"
        ></app-settings-sources>
      }

      @if (selectedVideo()) {
        <app-video-player-popup
          [video]="selectedVideo()!"
          (closed)="selectedVideo.set(null)"
          (openPanel)="selectedVideo.set(null); panelVideo.set($event)"
        ></app-video-player-popup>
      }

      @if (panelVideo()) {
        <app-video-player-panel
          [video]="panelVideo()!"
          (closed)="panelVideo.set(null)"
        ></app-video-player-panel>
      }

      @if (showStreamList()) {
        <app-stream-list-popup
          [streams]="streamsStore.streams()"
          (closed)="showStreamList.set(false)"
          (selectStream)="showStreamList.set(false); onStreamSelect($event)"
        ></app-stream-list-popup>
      }

      <div class="flex pt-12 min-h-screen">
        <main class="flex-1 min-w-0">
        <div class="p-6 max-w-screen-2xl mx-auto">

        <!-- Top Row: Market (5-col) + YouTube (7-col) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <app-market-section></app-market-section>
          <app-youtube-section
            (selectVideo)="selectedVideo.set($event)"
            (openSettings)="showSources.set(true)"
          ></app-youtube-section>
        </div>

        <div class="mt-8">
          @defer (on viewport) {
            <app-streams-section
              (selectStream)="onStreamSelect($event)"
              (openStreamList)="showStreamList.set(true)"
              (openSettings)="showSources.set(true)"
            ></app-streams-section>
          } @placeholder {
            <div class="min-h-[320px]"><app-skeleton variant="row" /></div>
          }
        </div>

        <!-- Bottom Row: AI Blog (6-col) + Trump Watch (6-col) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
          @defer (on viewport) {
            <app-news-section
              (feedAdded)="onFeedAdded($event)"
            ></app-news-section>
          } @placeholder {
            <div class="min-h-[420px]"><app-skeleton variant="card" /></div>
          }
          @defer (on viewport) {
            <app-trump-section></app-trump-section>
          } @placeholder {
            <div class="min-h-[420px]"><app-skeleton variant="post" /></div>
          }
        </div>
        </div>
        </main>

        @if (selectedStream()) {
          <app-stream-player-panel
            [stream]="selectedStream()!"
            (closed)="closeSelectedStream()"
          ></app-stream-player-panel>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, OnDestroy {
  private static readonly RETRY_DELAYS_MS = [2000, 5000, 10000];
  private static readonly MAX_RETRIES = 3;
  private static readonly DEFAULT_GLOBAL_REFRESH_MS = 5 * 60 * 1000;

  private apiService = inject(ApiService);
  private toastService = inject(ToastService);

  readonly videosStore = inject(VideosStore);
  readonly newsStore = inject(NewsStore);
  readonly trumpStore = inject(TrumpStore);
  readonly streamsStore = inject(StreamsStore);
  readonly marketStore = inject(MarketStore);

  dashboardData = signal<DashboardData | null>(null);
  isLoading = signal(true);
  isLive = signal(false);
  isRefreshing = signal(false);
  refreshStatus = signal<'idle' | 'refreshing' | 'updated' | 'error'>('idle');
  lastUpdatedLabel = signal('');
  showOptions = signal(false);
  showSources = signal(false);
  showWeather = signal(false);
  showStreamList = signal(false);
  selectedStreamId = signal<string | null>(null);
  selectedStream = signal<TwitchStream | null>(null);
  selectedVideo = signal<YoutubeVideo | null>(null);
  panelVideo = signal<YoutubeVideo | null>(null);

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showOptions()) { this.showOptions.set(false); return; }
    if (this.showSources()) { this.showSources.set(false); return; }
    if (this.showStreamList()) { this.showStreamList.set(false); return; }
    if (this.showWeather()) { this.showWeather.set(false); return; }
    if (this.selectedVideo()) { this.selectedVideo.set(null); return; }
    if (this.panelVideo()) { this.panelVideo.set(null); return; }
    if (this.selectedStream()) { this.closeSelectedStream(); }
  }

  ngOnInit() {
    this.loadDashboard();
    window.setTimeout(() => {
      if (!this.trumpStore.count()) {
        this.trumpStore.reload();
      }
    }, 2500);
  }

  private weatherRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private refreshBadgeTimeout: ReturnType<typeof setTimeout> | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private globalRefreshTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy() {
    this.stopStoreAutoRefreshes();
    this.cancelPendingRetry();
    if (this.weatherRefreshInterval) {
      clearInterval(this.weatherRefreshInterval);
    }
    if (this.refreshBadgeTimeout) {
      clearTimeout(this.refreshBadgeTimeout);
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
    this.lastUpdatedLabel.set(this.formatUpdatedLabel(data.refreshedAt));
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
    this.cancelPendingRetry();
    // Only show skeletons when there is nothing to display yet. If the stores
    // already hold data (e.g. manual refresh after a first successful load),
    // refresh silently so existing sections do not flash back to skeletons.
    if (this.areStoresEmpty()) {
      this.setSectionLoading(true);
    }
    this.fetchDashboardWithRetry(0);
  }

  private fetchDashboardWithRetry(attempt: number) {
    this.apiService.getDashboardStream(() => undefined).subscribe({
      next: (data) => {
        this.applyDashboardData(data);
        this.startStoreAutoRefreshes();
      },
      error: () => {
        this.apiService.getDashboard().subscribe({
          next: (data) => {
            this.applyDashboardData(data);
            this.startStoreAutoRefreshes();
          },
          error: () => {
            if (attempt < DashboardComponent.MAX_RETRIES) {
              // Backoff: 2s, 5s, 10s between attempts.
              const delay = DashboardComponent.RETRY_DELAYS_MS[attempt];
              this.retryTimeout = setTimeout(() => {
                this.retryTimeout = null;
                this.fetchDashboardWithRetry(attempt + 1);
              }, delay);
            } else {
              // Give up on skeletons but keep per-section auto-refresh running;
              // sections keep their own polling and can recover on their own.
              this.setSectionLoading(false);
              this.isLoading.set(false);
              this.startStoreAutoRefreshes();
              this.toastService.error('Dashboard refresh failed. Automatic retries will continue.');
            }
          }
        });
      }
    });
  }

  private areStoresEmpty(): boolean {
    return (
      this.videosStore.count() === 0 &&
      this.newsStore.count() === 0 &&
      this.trumpStore.count() === 0 &&
      this.streamsStore.count() === 0 &&
      this.marketStore.count() === 0
    );
  }

  private cancelPendingRetry() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  private setSectionLoading(loading: boolean) {
    this.videosStore.setLoading(loading);
    this.newsStore.setLoading(loading);
    this.trumpStore.setLoading(loading);
    this.streamsStore.setLoading(loading);
    this.marketStore.setLoading(loading);
  }

  private startStoreAutoRefreshes() {
    this.stopStoreAutoRefreshes();
    this.isLive.set(true);
    this.marketStore.startAutoRefresh();
    this.trumpStore.startAutoRefresh();
    if (!this.trumpStore.count() && !this.trumpStore.isLoading()) {
      this.trumpStore.reload();
    }
    this.newsStore.startAutoRefresh();
    this.streamsStore.startAutoRefresh();
    this.videosStore.startAutoRefresh();
    this.startWeatherRefresh();
    this.startGlobalRefresh();
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
    if (this.globalRefreshTimer) {
      clearInterval(this.globalRefreshTimer);
      this.globalRefreshTimer = null;
    }
  }

  private startGlobalRefresh() {
    if (this.globalRefreshTimer) {
      clearInterval(this.globalRefreshTimer);
      this.globalRefreshTimer = null;
    }
    // Global silent refresh: pulls the aggregated /dashboard snapshot
    // (cache-first on the backend) without touching section skeletons or the
    // refresh badge. Per-store auto-refreshes keep running independently, so
    // this never spams the market endpoint.
    this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        // refreshInterval is expressed in minutes (default 30 in settings).
        const minutes = prefs.refreshInterval && prefs.refreshInterval > 0
          ? prefs.refreshInterval
          : 5;
        const ms = Math.max(DashboardComponent.DEFAULT_GLOBAL_REFRESH_MS, minutes * 60 * 1000);
        this.globalRefreshTimer = setInterval(() => this.silentGlobalRefresh(), ms);
      },
      error: () => {
        this.globalRefreshTimer = setInterval(() => this.silentGlobalRefresh(), DashboardComponent.DEFAULT_GLOBAL_REFRESH_MS);
      },
    });
  }

  private silentGlobalRefresh() {
    this.apiService.getDashboard().subscribe({
      next: (data) => this.applyDashboardData(data),
      error: (err) => {
        // Keep whatever data is already displayed; per-store auto-refreshes
        // keep trying independently.
        console.warn('Global dashboard refresh failed:', err);
      },
    });
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

  onSettingsSaved() {
    this.loadDashboard();
    this.startStoreAutoRefreshes();
  }

  refreshDashboard() {
    if (this.isRefreshing()) return;

    this.cancelPendingRetry();
    this.isRefreshing.set(true);
    this.refreshStatus.set('refreshing');
    this.setSectionLoading(true);

    this.apiService.refreshAll().subscribe({
      next: () => {
        this.apiService.getDashboard().subscribe({
          next: (data) => {
            this.applyDashboardData(data);
            this.finishRefresh('updated');
          },
          error: () => {
            this.setSectionLoading(false);
            this.finishRefresh('error');
          },
        });
      },
      error: () => {
        this.setSectionLoading(false);
        this.finishRefresh('error');
      },
    });
  }

  onFeedAdded(feedUrl: string) {
    this.apiService.getPreferences().pipe(
      switchMap((prefs) => {
        const existing = (prefs.customRssFeeds || '').trim();
        const updated = existing ? `${existing}\n${feedUrl}` : feedUrl;
        return this.apiService.savePreferences({ customRssFeeds: updated });
      }),
      switchMap(() => this.apiService.refreshNews()),
      switchMap(() => this.apiService.getNews()),
    ).subscribe({
      next: (news) => {
        this.newsStore.setItems(news || []);
        this.dashboardData.update((current) => current ? ({ ...current, news: news || [] }) : current);
      },
      error: (err) => {
        console.warn('Failed to add RSS feed:', err);
        this.toastService.error("Impossible d'ajouter ce flux RSS.");
      },
    });
  }

  private finishRefresh(status: 'updated' | 'error') {
    this.isRefreshing.set(false);
    this.refreshStatus.set(status);

    if (this.refreshBadgeTimeout) {
      clearTimeout(this.refreshBadgeTimeout);
    }

    this.refreshBadgeTimeout = setTimeout(() => {
      this.refreshStatus.set('idle');
    }, 4000);
  }

  private formatUpdatedLabel(value: Date | string | null | undefined): string {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

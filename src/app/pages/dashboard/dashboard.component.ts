import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { StreamListPopupComponent } from '../../components/stream/stream-list-popup.component';
import { VideoPlayerPopupComponent } from '../../components/video/video-player-popup.component';
import { VideoPlayerPanelComponent } from '../../components/video/video-player-panel.component';
import { SettingsModalComponent } from '../../components/settings-modal/settings-modal.component';
import { WeatherPopupComponent } from '../../components/weather/weather-popup.component';
import { TwitterSectionComponent } from '../../components/sections/twitter-section.component';
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
import { TweetsStore } from '../../stores/tweets.store';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    StreamPlayerPanelComponent,
    StreamListPopupComponent,
    VideoPlayerPopupComponent,
    VideoPlayerPanelComponent,
    SettingsModalComponent,
    WeatherPopupComponent,
    TwitterSectionComponent,
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
        [tweetCount]="tweetsStore.count()"
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
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <app-twitter-section></app-twitter-section>
            <app-youtube-section
              (selectVideo)="selectedVideo.set($event)"
              (openSettings)="showSettings.set(true)"
            ></app-youtube-section>
          </div>

          <app-streams-section
            (selectStream)="onStreamSelect($event)"
            (openStreamList)="showStreamList.set(true)"
            (openSettings)="showSettings.set(true)"
          ></app-streams-section>

          <!-- Bottom Row: AI Blog (6-col) + Trump Watch (6-col) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <app-news-section
              (feedAdded)="onFeedAdded($event)"
            ></app-news-section>
            <app-trump-section></app-trump-section>
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
  private toastService = inject(ToastService);

  readonly videosStore = inject(VideosStore);
  readonly newsStore = inject(NewsStore);
  readonly trumpStore = inject(TrumpStore);
  readonly streamsStore = inject(StreamsStore);
  readonly tweetsStore = inject(TweetsStore);

  dashboardData = signal<DashboardData | null>(null);
  isLoading = signal(true);
  isSyncing = signal(false);
  loadingStatus = signal('LOADING DASHBOARD...');
  showSettings = signal(false);
  showWeather = signal(false);
  showStreamList = signal(false);
  selectedStream = signal<TwitchStream | null>(null);
  selectedVideo = signal<YoutubeVideo | null>(null);
  panelVideo = signal<YoutubeVideo | null>(null);

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showStreamList()) { this.showStreamList.set(false); return; }
    if (this.showWeather()) { this.showWeather.set(false); return; }
    if (this.selectedVideo()) { this.selectedVideo.set(null); return; }
    if (this.panelVideo()) { this.panelVideo.set(null); return; }
    if (this.selectedStream()) { this.selectedStream.set(null); }
  }

  ngOnInit() {
    this.loadDashboard();
  }

  onStreamSelect(stream: TwitchStream) {
    if (stream.gameName === 'YouTube Live') {
      this.panelVideo.set({
        id: stream.id,
        youtubeId: stream.twitchId,
        title: stream.title,
        thumbnailUrl: stream.thumbnailUrl,
        channelName: stream.channelName,
        channelAvatar: stream.channelAvatar,
        duration: 'LIVE',
        views: stream.viewerCount,
        url: stream.url,
        isLive: true,
      } as YoutubeVideo);
    } else {
      this.selectedStream.set(stream);
    }
  }

  loadDashboard() {
    console.log('[loadDashboard] START');
    this.isLoading.set(true);
    this.loadingStatus.set('CONNECTING...');

    this.apiService.getDashboardStream((step: string) => {
      console.log('[loadDashboard] SSE progress:', step);
      this.loadingStatus.set(step.toUpperCase());
    }).subscribe({
      next: (data) => {
        console.log('[loadDashboard] SSE data received — counts:', {
          streams: data.streams?.length ?? 0,
          videos: data.videos?.length ?? 0,
          news: data.news?.length ?? 0,
          trump: data.trump?.length ?? 0,
          tweets: data.tweets?.length ?? 0,
        });

        this.videosStore.setItems(data.videos || []);
        this.newsStore.setItems(data.news || []);
        this.trumpStore.setItems(data.trump || []);
        this.streamsStore.setItems(data.streams || []);
        this.tweetsStore.setItems(data.tweets || []);

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
      error: (sseErr) => {
        console.warn('[loadDashboard] SSE failed, falling back to REST:', sseErr);
        this.loadingStatus.set('LOADING DASHBOARD...');
        this.apiService.getDashboard().subscribe({
          next: (data) => {
            console.log('[loadDashboard] REST fallback data:', {
              streams: data.streams?.length ?? 0,
              videos: data.videos?.length ?? 0,
              news: data.news?.length ?? 0,
              trump: data.trump?.length ?? 0,
            });
            this.videosStore.setItems(data.videos || []);
            this.newsStore.setItems(data.news || []);
            this.trumpStore.setItems(data.trump || []);
            this.streamsStore.setItems(data.streams || []);
            this.tweetsStore.setItems(data.tweets || []);
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
    this.loadDashboard();
  }

  onFeedAdded(feedUrl: string) {
    console.log('[onFeedAdded] feed URL:', feedUrl);
    this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        const existing = (prefs.customRssFeeds || '').trim();
        const updated = existing ? `${existing}\n${feedUrl}` : feedUrl;
        console.log('[onFeedAdded] saving prefs, customRssFeeds:', updated.substring(0, 80));
        this.apiService.savePreferences({ customRssFeeds: updated }).subscribe({
          next: () => {
            console.log('[onFeedAdded] prefs saved, calling refreshNews...');
            this.apiService.refreshNews().subscribe({
              next: () => { console.log('[onFeedAdded] news refreshed, reloading dashboard'); this.loadDashboard(); },
              error: (e) => { console.error('[onFeedAdded] refreshNews error:', e); this.loadDashboard(); },
            });
          },
          error: (e) => console.error('[onFeedAdded] savePreferences error:', e),
        });
      },
      error: (e) => console.error('[onFeedAdded] getPreferences error:', e),
    });
  }
}
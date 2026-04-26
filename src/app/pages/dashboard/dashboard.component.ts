import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../components/header/header.component';
import { StreamCardComponent } from '../../components/stream/stream-card.component';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { StreamListPopupComponent } from '../../components/stream/stream-list-popup.component';
import { VideoCardComponent } from '../../components/video/video-card.component';
import { VideoPlayerPopupComponent } from '../../components/video/video-player-popup.component';
import { VideoPlayerPanelComponent } from '../../components/video/video-player-panel.component';
import { TweetCardComponent } from '../../components/tweet/tweet-card.component';
import { AiNewsCardComponent } from '../../components/ai-news/ai-news-card.component';
import { TrumpCardComponent } from '../../components/trump/trump-card.component';
import { SettingsModalComponent } from '../../components/settings-modal/settings-modal.component';
import { WeatherPopupComponent } from '../../components/weather/weather-popup.component';
import { RssDetectModalComponent } from '../../components/rss-detect-modal/rss-detect-modal.component';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
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
    StreamListPopupComponent,
    VideoCardComponent,
    VideoPlayerPopupComponent,
    VideoPlayerPanelComponent,
    TweetCardComponent,
    AiNewsCardComponent,
    TrumpCardComponent,
    SettingsModalComponent,
    WeatherPopupComponent,
    RssDetectModalComponent,
    InfiniteScrollDirective,
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

      @if (showRssDetect()) {
        <app-rss-detect-modal
          (close)="showRssDetect.set(false)"
          (feedAdded)="onFeedAdded($event)"
        ></app-rss-detect-modal>
      }

      @if (showStreamList()) {
        <app-stream-list-popup
          [streams]="dashboardData()?.streams || []"
          (close)="showStreamList.set(false)"
          (selectStream)="showStreamList.set(false); onStreamSelect($event)"
        ></app-stream-list-popup>
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
                  <span class="font-label-caps text-[9px] text-text-muted">({{ dashboardData()?.tweets?.length || 0 }})</span>
                </div>
                @if (isLoadingMoreTweets()) {
                  <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                  </svg>
                }
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 380px">
                @for (tweet of dashboardData()?.tweets || []; track tweet.id || $index) {
                  <app-tweet-card [tweet]="tweet"></app-tweet-card>
                }
                <div
                  appInfiniteScroll
                  [disabled]="isLoadingMoreTweets()"
                  (scrolledToEnd)="loadMoreTweets()"
                  class="h-1"
                ></div>
                @if (isLoadingMoreTweets()) {
                  <div class="text-center py-2">
                    <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
                  </div>
                }
                @if (!dashboardData()?.tweets?.length) {
                  <div class="p-6 text-center">
                    <p class="font-label-caps text-[10px] text-text-muted mb-2">SERVICE UNAVAILABLE</p>
                    <p class="text-[10px] text-text-muted/60">X / Twitter feed is temporarily disabled.</p>
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
                  <span class="font-label-caps text-[9px] text-text-muted">({{ dashboardData()?.videos?.length || 0 }}/{{ videoLimit() }})</span>
                </div>
                @if (isLoadingMoreVideos()) {
                  <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                  </svg>
                }
              </div>
               <div class="flex-1 p-4 space-y-4 overflow-y-auto" style="max-height: 380px">
                @for (video of dashboardData()?.videos || []; track video.id || $index) {
                  <app-video-card [video]="video" (select)="selectedVideo.set($event)"></app-video-card>
                }
                <div
                  appInfiniteScroll
                  [disabled]="isLoadingMoreVideos()"
                  (scrolledToEnd)="loadMoreVideos()"
                  class="h-1"
                ></div>
                @if (isLoadingMoreVideos()) {
                  <div class="text-center py-2">
                    <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
                  </div>
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
              <button (click)="showStreamList.set(true)" class="flex items-center gap-2 hover:text-primary transition-colors group cursor-pointer">
                <svg class="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant group-hover:text-primary">LIVE STREAMS</span>
              </button>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              @for (stream of dashboardData()?.streams || []; track stream.twitchId || stream.id || $index) {
                <app-stream-card [stream]="stream" (select)="onStreamSelect($event)"></app-stream-card>
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
                <div class="flex items-center gap-2">
                  <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">AI BLOG</span>
                  <span class="font-label-caps text-[9px] text-text-muted">({{ sortedNews().length }})</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-label-caps text-[9px] text-text-muted">ANTHROPIC · OPENAI · KIMI · RSS</span>
                  @if (isLoadingMoreNews()) {
                    <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                    </svg>
                  }
                  <span class="font-label-caps text-[8px] px-1 py-0.5 rounded"
                    [class]="newsSortMode() === 'date' ? 'bg-primary/20 text-primary' : 'bg-yellow-500/20 text-yellow-400'"
                  >{{ newsSortMode() === 'date' ? 'DATE' : 'PERTINENCE' }}</span>
                  <button
                    (click)="toggleNewsSort()"
                    class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
                    [title]="newsSortMode() === 'date' ? 'Basculer en tri par pertinence' : 'Basculer en tri par date'"
                  >
                    @if (newsSortMode() === 'date') {
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    } @else {
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    }
                  </button>
                  <button
                    (click)="showRssDetect.set(true)"
                    class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
                    title="Ajouter un flux RSS"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 500px">
                @for (item of sortedNews(); track item.id || $index) {
                  <app-ai-news-card [item]="item"></app-ai-news-card>
                }
                <div
                  appInfiniteScroll
                  [disabled]="isLoadingMoreNews()"
                  (scrolledToEnd)="loadMoreNews()"
                  class="h-1"
                ></div>
                @if (isLoadingMoreNews()) {
                  <div class="text-center py-2">
                    <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
                  </div>
                }
                @if (!dashboardData()?.news?.length) {
                  <p class="font-label-caps text-[10px] text-text-muted p-4">NO ARTICLES</p>
                }
              </div>
            </section>

            <!-- Trump Watch -->
            <section class="neo-glass rounded overflow-hidden flex flex-col fade-in" style="animation-delay: 200ms">
              <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
                <div class="flex items-center gap-2">
                  <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">TRUMP WATCH</span>
                  <span class="font-label-caps text-[9px] text-text-muted">({{ dashboardData()?.trump?.length || 0 }})</span>
                </div>
                <div class="flex items-center gap-2">
                  @if (isLoadingMoreTrump()) {
                    <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
                    </svg>
                  }
                  <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 text-red-400">CRITICALITY</span>
                </div>
              </div>
              <div class="flex-1 overflow-y-auto" style="max-height: 500px">
                @for (item of dashboardData()?.trump || []; track item.tweetId || item.id || $index) {
                  <app-trump-card [item]="item"></app-trump-card>
                }
                <div
                  appInfiniteScroll
                  [disabled]="isLoadingMoreTrump()"
                  (scrolledToEnd)="loadMoreTrump()"
                  class="h-1"
                ></div>
                @if (isLoadingMoreTrump()) {
                  <div class="text-center py-2">
                    <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
                  </div>
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
  showRssDetect = signal(false);
  showStreamList = signal(false);
  selectedStream = signal<TwitchStream | null>(null);
  selectedVideo = signal<YoutubeVideo | null>(null);
  panelVideo = signal<YoutubeVideo | null>(null);

  // Lazy loading — videos
  videoLimit = signal(20);
  isLoadingMoreVideos = signal(false);
  videosAtEnd = signal(false);

  // Lazy loading — news
  newsLimit = signal(20);
  isLoadingMoreNews = signal(false);

  // Lazy loading — trump
  trumpLimit = signal(20);
  isLoadingMoreTrump = signal(false);

  // Lazy loading — tweets
  tweetLimit = signal(20);
  isLoadingMoreTweets = signal(false);

  readonly maxLimit = 100;

  // News sort
  newsSortMode = signal<'date' | 'relevance'>('date');

  sortedNews = computed(() => {
    const news = this.dashboardData()?.news || [];
    const mode = this.newsSortMode();
    console.log(`[sortedNews] mode=${mode} count=${news.length}`);
    if (news.length > 0) {
      console.log('[sortedNews] sample dates:', news.slice(0, 3).map(n => ({
        title: n.title?.substring(0, 30),
        pubDate: n.pubDate,
        createdAt: n.createdAt,
      })));
    }
    if (mode === 'date') {
      const sorted = [...news].sort((a, b) => {
        const dateA = new Date(a.pubDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.pubDate || b.createdAt || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        // tie-break: createdAt desc
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
      console.log('[sortedNews] sorted by date, first 3:', sorted.slice(0, 3).map(n => n.title?.substring(0, 30)));
      return sorted;
    }
    console.log('[sortedNews] relevance order (backend order)');
    return news;
  });

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.showStreamList()) { this.showStreamList.set(false); return; }
    if (this.showRssDetect()) { this.showRssDetect.set(false); return; }
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

  loadMoreVideos() {
    if (this.isLoadingMoreVideos() || this.videosAtEnd()) return;
    const current = this.videoLimit();
    const next = Math.min(current + 20, this.maxLimit);
    console.log(`[loadMoreVideos] loading more — current=${current} next=${next}`);
    this.isLoadingMoreVideos.set(true);
    this.apiService.getVideos(next).subscribe({
      next: (videos) => {
        console.log(`[loadMoreVideos] received ${videos.length} videos (requested limit=${next})`);
        const data = this.dashboardData();
        if (data) this.dashboardData.set({ ...data, videos });
        this.videoLimit.set(next);
        this.isLoadingMoreVideos.set(false);
        if (videos.length < next) {
          console.log(`[loadMoreVideos] DB exhausted — no more data`);
          this.videosAtEnd.set(true);
        }
      },
      error: (e) => { console.error('[loadMoreVideos] error:', e); this.isLoadingMoreVideos.set(false); },
    });
  }

  loadMoreNews() {
    const current = this.newsLimit();
    const next = Math.min(current + 20, this.maxLimit);
    console.log(`[loadMoreNews] sentinel fired — current=${current} next=${next} max=${this.maxLimit}`);
    if (next === current) { console.log('[loadMoreNews] already at max, skipping'); return; }
    this.isLoadingMoreNews.set(true);
    this.apiService.getNews(next).subscribe({
      next: (news) => {
        console.log(`[loadMoreNews] received ${news.length} items (requested limit=${next})`);
        const data = this.dashboardData();
        if (data) this.dashboardData.set({ ...data, news });
        this.newsLimit.set(next);
        this.isLoadingMoreNews.set(false);
        if (news.length < next) {
          console.log(`[loadMoreNews] DB exhausted (got ${news.length} < ${next}) — no more data`);
          this.newsLimit.set(this.maxLimit);
        }
      },
      error: (e) => { console.error('[loadMoreNews] error:', e); this.isLoadingMoreNews.set(false); },
    });
  }

  loadMoreTrump() {
    const current = this.trumpLimit();
    const next = Math.min(current + 20, this.maxLimit);
    console.log(`[loadMoreTrump] sentinel fired — current=${current} next=${next} max=${this.maxLimit}`);
    if (next === current) { console.log('[loadMoreTrump] already at max, skipping'); return; }
    this.isLoadingMoreTrump.set(true);
    this.apiService.getTrumpTweets(next).subscribe({
      next: (trump) => {
        console.log(`[loadMoreTrump] received ${trump.length} items (requested limit=${next})`);
        const data = this.dashboardData();
        if (data) this.dashboardData.set({ ...data, trump });
        this.trumpLimit.set(next);
        this.isLoadingMoreTrump.set(false);
        if (trump.length < next) {
          console.log(`[loadMoreTrump] DB exhausted (got ${trump.length} < ${next}) — no more data`);
          this.trumpLimit.set(this.maxLimit);
        }
      },
      error: (e) => { console.error('[loadMoreTrump] error:', e); this.isLoadingMoreTrump.set(false); },
    });
  }

  loadMoreTweets() {
    console.log('[loadMoreTweets] Twitter/X disabled — no-op');
  }

  toggleNewsSort() {
    const prev = this.newsSortMode();
    const next = prev === 'date' ? 'relevance' : 'date';
    console.log(`[toggleNewsSort] ${prev} → ${next}`);
    this.newsSortMode.set(next);
  }

  loadDashboard() {
    console.log('[loadDashboard] START');
    this.isLoading.set(true);
    this.loadingStatus.set('CONNECTING...');
    this.videoLimit.set(20);
    this.newsLimit.set(20);
    this.trumpLimit.set(20);
    this.tweetLimit.set(20);
    this.isLoadingMoreVideos.set(false);
    this.isLoadingMoreNews.set(false);
    this.isLoadingMoreTrump.set(false);
    this.isLoadingMoreTweets.set(false);
    this.videosAtEnd.set(false);
    this.videosAtEnd.set(false);

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

        // ── STREAMS ──────────────────────────────────────────────────
        console.groupCollapsed(`[STREAMS] ${data.streams?.length ?? 0} items`);
        (data.streams || []).forEach((s: any, i: number) => {
          console.log(`  [${i}] ${s.channelName} | live=${s.isLive} | viewers=${s.viewerCount} | game=${s.gameName} | id=${s.twitchId}`);
        });
        console.groupEnd();

        // ── VIDEOS ───────────────────────────────────────────────────
        console.groupCollapsed(`[VIDEOS] ${data.videos?.length ?? 0} items`);
        (data.videos || []).forEach((v: any, i: number) => {
          console.log(`  [${i}] ${v.channelName} | "${v.title?.substring(0,50)}" | publishedAt=${v.publishedAt} | isLive=${v.isLive}`);
        });
        console.groupEnd();

        // ── NEWS ─────────────────────────────────────────────────────
        console.groupCollapsed(`[NEWS] ${data.news?.length ?? 0} items`);
        (data.news || []).forEach((n: any, i: number) => {
          console.log(`  [${i}] [${n.source}] "${n.title?.substring(0,50)}" | pubDate=${n.pubDate} | createdAt=${n.createdAt}`);
        });
        console.groupEnd();

        // ── TRUMP ────────────────────────────────────────────────────
        console.groupCollapsed(`[TRUMP] ${data.trump?.length ?? 0} items`);
        (data.trump || []).forEach((t: any, i: number) => {
          console.log(`  [${i}] criticality=${t.criticality} | "${t.content?.substring(0,60)}" | tweetDate=${t.tweetDate}`);
        });
        console.groupEnd();

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
    this.showRssDetect.set(false);
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

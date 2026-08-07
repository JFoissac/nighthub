import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../services/api.service';
import { StreamPlayerPanelComponent } from '../../components/stream/stream-player-panel.component';
import { VideosStore } from '../../stores/videos.store';
import { NewsStore } from '../../stores/news.store';
import { TrumpStore } from '../../stores/trump.store';
import { StreamsStore } from '../../stores/streams.store';
import { MarketStore } from '../../stores/market.store';
import { of, Subject } from 'rxjs';

class MockIntersectionObserver {
  constructor() {}
  observe() {}
  disconnect() {}
  unobserve() {}
  root = null;
  rootMargin = '';
  thresholds = [];
  takeRecords = () => [];
}

global.IntersectionObserver = MockIntersectionObserver as any;

const createMockStore = () => {
  const store: any = {
    count: signal(0),
    isLoading: signal(false),
    items: signal([]),
    videos: signal([]),
    news: signal([]),
    streams: signal([]),
    filteredStreams: signal([]),
    gameList: signal([]),
    gameFilter: signal<string | null>(null),
    tweets: signal([]),
    crypto: signal([]),
    stocks: signal([]),
    market: signal([]),
    groupedStocks: signal([]),
    hasError: signal(false),
    loading: signal(false),
    error: signal(null),
    atEnd: signal(false),
  };

  store.setItems = (items: any[]) => {
    store.items.set(items);
    store.videos.set(items);
    store.news.set(items);
    store.streams.set(items);
    store.filteredStreams.set(items);
    store.count.set(items.length);
    store.loading.set(false);
    store.isLoading.set(false);
  };

  store.setGameFilter = jest.fn();
  store.setLoading = (loading: boolean) => {
    store.loading.set(loading);
    store.isLoading.set(loading);
  };
  store.loadMore = jest.fn();
  store.reload = jest.fn(() => store.setLoading(true));
  store.startAutoRefresh = jest.fn();
  store.stopAutoRefresh = jest.fn();

  return store;
};

const createStream = (overrides: Partial<any> = {}) => ({
  id: 'stream-a',
  twitchId: '111',
  title: 'Live coding session',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  viewerCount: 123,
  channelName: 'StreamerA',
  channelHandle: '@streamera',
  channelLogin: 'streamera',
  channelAvatar: 'https://example.com/avatar.jpg',
  gameName: 'Coding',
  isLive: true,
  url: 'https://www.twitch.tv/streamera',
  ...overrides,
});

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockApiService: any;
  let mockVideosStore: any;
  let mockNewsStore: any;
  let mockTrumpStore: any;
  let mockStreamsStore: any;
  let mockMarketStore: any;

  beforeEach(async () => {
    mockApiService = {
      getDashboardStream: jest.fn().mockReturnValue(of({
        videos: [],
        streams: [],
        news: [],
        trump: [],
        market: [],
        weather: null,
        refreshedAt: new Date(),
      })),
      getDashboard: jest.fn().mockReturnValue(of({
        videos: [],
        streams: [],
        news: [],
        trump: [],
        market: [],
        weather: null,
        refreshedAt: new Date(),
      })),
      getPreferences: jest.fn().mockReturnValue(of({
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
      })),
      savePreferences: jest.fn().mockReturnValue(of({})),
      refreshAll: jest.fn().mockReturnValue(of({})),
      refreshNews: jest.fn().mockReturnValue(of({})),
      getNews: jest.fn().mockReturnValue(of([])),
      getTrumpTweets: jest.fn().mockReturnValue(of([])),
      extractNewsArticle: jest.fn().mockReturnValue(of(null)),
      getAuthStatus: jest.fn().mockReturnValue(of({ youtube: false, twitch: false })),
      getTwitchPlayback: jest.fn().mockReturnValue(of({ anonymous: true })),
    };

    mockVideosStore = createMockStore();
    mockNewsStore = createMockStore();
    mockTrumpStore = createMockStore();
    mockStreamsStore = createMockStore();
    mockMarketStore = createMockStore();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        { provide: ApiService, useValue: mockApiService },
      ],
    })
    .overrideProvider(VideosStore, { useValue: mockVideosStore })
    .overrideProvider(NewsStore, { useValue: mockNewsStore })
    .overrideProvider(TrumpStore, { useValue: mockTrumpStore })
    .overrideProvider(StreamsStore, { useValue: mockStreamsStore })
    .overrideProvider(MarketStore, { useValue: mockMarketStore })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should inject all 5 stores', () => {
    expect(component.videosStore).toBeDefined();
    expect(component.newsStore).toBeDefined();
    expect(component.trumpStore).toBeDefined();
    expect(component.streamsStore).toBeDefined();
    expect(component.marketStore).toBeDefined();
  });

  it('should call getDashboardStream on init', () => {
    expect(mockApiService.getDashboardStream).toHaveBeenCalled();
  });

  it('should have initial loading state', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should have weather popup initially hidden', () => {
    expect(component.showWeather()).toBe(false);
  });

  it('should have options popup initially hidden', () => {
    expect(component.showOptions()).toBe(false);
  });

  it('should have sources popup initially hidden', () => {
    expect(component.showSources()).toBe(false);
  });

  it('should have stream list popup initially hidden', () => {
    expect(component.showStreamList()).toBe(false);
  });

  it('shows section skeletons while aggregated dashboard data is still loading', async () => {
    const pending = new Subject<any>();
    mockApiService.getDashboardStream.mockReturnValueOnce(pending.asObservable());

    const loadingFixture = TestBed.createComponent(DashboardComponent);
    loadingFixture.detectChanges();

    const compiled = loadingFixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('LOADING...');
    expect(compiled.textContent).not.toContain('NO CHANNELS CONFIGURED');
    expect(compiled.textContent).not.toContain('NO ARTICLES');
    expect(compiled.textContent).not.toContain('NO DATA');
    expect(compiled.textContent).not.toContain('NO STREAMS LIVE');
  });

  it('keeps stream player panel mounted and iframe src stable when dashboard refresh returns the same stream id', () => {
    const initial = createStream();
    component.onStreamSelect(initial);
    fixture.detectChanges();

    const panelBefore = fixture.debugElement.query(By.directive(StreamPlayerPanelComponent))?.componentInstance;
    const iframeBefore = fixture.nativeElement.querySelector('app-stream-player-panel iframe') as HTMLIFrameElement | null;
    const srcBefore = iframeBefore?.getAttribute('src') ?? null;

    (component as any).applyDashboardData({
      videos: [],
      streams: [createStream({ title: 'Live coding session (updated)', viewerCount: 999 })],
      news: [],
      trump: [],
      market: [],
      weather: null,
      refreshedAt: new Date(),
    });
    fixture.detectChanges();

    const panelAfter = fixture.debugElement.query(By.directive(StreamPlayerPanelComponent))?.componentInstance;
    const iframeAfter = fixture.nativeElement.querySelector('app-stream-player-panel iframe') as HTMLIFrameElement | null;
    const srcAfter = iframeAfter?.getAttribute('src') ?? null;

    expect(panelAfter).toBe(panelBefore);
    expect(component.selectedStreamId()).toBe('stream-a');
    expect(component.selectedStream()?.viewerCount).toBe(999);
    expect(srcAfter).toBe(srcBefore);
  });

  it('keeps side panel open with offline state when selected stream disappears after refresh', () => {
    component.onStreamSelect(createStream());
    fixture.detectChanges();

    (component as any).applyDashboardData({
      videos: [],
      streams: [],
      news: [],
      trump: [],
      market: [],
      weather: null,
      refreshedAt: new Date(),
    });
    fixture.detectChanges();

    expect(component.selectedStream()?.id).toBe('stream-a');
    expect(component.selectedStream()?.isLive).toBe(false);
    expect(fixture.debugElement.query(By.directive(StreamPlayerPanelComponent))).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('OFFLINE');
  });

  it('renders the simplified dashboard chrome without the global loading banner or footer', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).not.toContain('INITIAL SYNC IN PROGRESS');
    expect(compiled.textContent).not.toContain('LAST UPDATE');
    expect(compiled.textContent).not.toContain('TWEETS:');
    expect(compiled.textContent).not.toContain('VID:');
    expect(compiled.textContent).not.toContain('NEWS:');
  });

  it('opens the two distinct settings popups', () => {
    component.showOptions.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-options')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-settings-sources')).toBeFalsy();

    component.showOptions.set(false);
    component.showSources.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-settings-options')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('app-settings-sources')).toBeTruthy();
  });

  it('refreshes in background without clearing visible data or closing the selected stream panel', () => {
    const initialStream = createStream();
    const refreshedStream = createStream({ viewerCount: 456, title: 'Live coding session refreshed' });
    const refreshRequest = new Subject<any>();
    const refreshedDashboard = {
      videos: [{ id: 'video-1', title: 'Updated video' }],
      streams: [refreshedStream],
      news: [{ id: 'news-1', title: 'Updated news' }],
      trump: [{ id: 'trump-1', content: 'Updated post' }],
      market: [{ symbol: 'NVDA', type: 'stock', price: 1200 }],
      weather: { city: 'Caen', days: [{ temp: 22, condition: 'Sunny' }] },
      refreshedAt: new Date(),
    };

    mockVideosStore.setItems([{ id: 'video-0', title: 'Existing video' }]);
    mockNewsStore.setItems([{ id: 'news-0', title: 'Existing news' }]);
    mockTrumpStore.setItems([{ id: 'trump-0', content: 'Existing post' }]);
    mockStreamsStore.setItems([initialStream]);
    mockMarketStore.setItems([{ symbol: 'BTC', type: 'crypto', price: 1 }]);
    component.dashboardData.set({
      videos: [{ id: 'video-0', title: 'Existing video' }],
      streams: [initialStream],
      news: [{ id: 'news-0', title: 'Existing news' }],
      trump: [{ id: 'trump-0', content: 'Existing post' }],
      market: [{ symbol: 'BTC', type: 'crypto', price: 1 }],
      weather: { city: 'Caen', days: [{ temp: 18, condition: 'Cloudy' }] },
      refreshedAt: new Date('2026-04-25T10:00:00.000Z'),
    });
    component.onStreamSelect(initialStream);
    mockApiService.refreshAll.mockReturnValueOnce(refreshRequest.asObservable());
    mockApiService.getDashboard.mockReturnValueOnce(of(refreshedDashboard));
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector('button[aria-label="Refresh dashboard"]') as HTMLButtonElement | null;
    expect(refreshButton).toBeTruthy();

    refreshButton?.click();
    fixture.detectChanges();

    expect(mockApiService.refreshAll).toHaveBeenCalledTimes(1);
    expect(mockVideosStore.isLoading()).toBe(true);
    expect(mockNewsStore.isLoading()).toBe(true);
    expect(mockTrumpStore.isLoading()).toBe(true);
    expect(mockStreamsStore.isLoading()).toBe(true);
    expect(mockMarketStore.isLoading()).toBe(true);
    expect(mockVideosStore.videos()[0]?.title).toBe('Existing video');
    expect(mockNewsStore.news()[0]?.title).toBe('Existing news');
    expect(component.selectedStream()?.id).toBe('stream-a');
    expect(fixture.debugElement.query(By.directive(StreamPlayerPanelComponent))).toBeTruthy();

    refreshRequest.next({ ok: true });
    refreshRequest.complete();
    fixture.detectChanges();

    expect(mockApiService.getDashboard).toHaveBeenCalledTimes(1);
    expect(mockVideosStore.videos()[0]?.title).toBe('Updated video');
    expect(mockNewsStore.news()[0]?.title).toBe('Updated news');
    expect(component.selectedStream()?.viewerCount).toBe(456);
    expect(component.selectedStream()?.title).toBe('Live coding session refreshed');
  });
});

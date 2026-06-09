import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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

const createMockStore = () => ({
  setItems: jest.fn(),
  setGameFilter: jest.fn(),
  loadMore: jest.fn(),
  reload: jest.fn(),
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
  market: signal([]),
  hasError: signal(false),
  loading: signal(false),
  error: signal(null),
  atEnd: signal(false),
});

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
  let refreshAllSubject: Subject<any>;

  beforeEach(async () => {
    refreshAllSubject = new Subject();

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
      refreshAll: jest.fn().mockReturnValue(refreshAllSubject.asObservable()),
      getPreferences: jest.fn().mockReturnValue(of({ customRssFeeds: '' })),
      savePreferences: jest.fn().mockReturnValue(of({})),
      refreshNews: jest.fn().mockReturnValue(of({})),
      getNews: jest.fn().mockReturnValue(of([])),
      getTrumpTweets: jest.fn().mockReturnValue(of([])),
      extractNewsArticle: jest.fn().mockReturnValue(of(null)),
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

  it('should call refreshAll via the refreshAll method', fakeAsync(() => {
    component.refreshAll();
    tick();
    expect(mockApiService.refreshAll).toHaveBeenCalled();
  }));

  it('should have initial loading state', () => {
    expect(component.isLoading()).toBe(false);
  });

  it('should have weather popup initially hidden', () => {
    expect(component.showWeather()).toBe(false);
  });

  it('should have settings modal initially hidden', () => {
    expect(component.showSettings()).toBe(false);
  });

  it('should have stream list popup initially hidden', () => {
    expect(component.showStreamList()).toBe(false);
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
});

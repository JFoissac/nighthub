import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../services/api.service';
import { VideosStore } from '../../stores/videos.store';
import { NewsStore } from '../../stores/news.store';
import { TrumpStore } from '../../stores/trump.store';
import { StreamsStore } from '../../stores/streams.store';
import { TweetsStore } from '../../stores/tweets.store';
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
  count: signal(0),
  isLoading: signal(false),
  items: signal([]),
  videos: signal([]),
  news: signal([]),
  streams: signal([]),
  tweets: signal([]),
  hasError: signal(false),
  loading: signal(false),
  error: signal(null),
  atEnd: signal(false),
});

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockApiService: any;
  let mockVideosStore: any;
  let mockNewsStore: any;
  let mockTrumpStore: any;
  let mockStreamsStore: any;
  let mockTweetsStore: any;
  let refreshAllSubject: Subject<any>;

  beforeEach(async () => {
    refreshAllSubject = new Subject();

    mockApiService = {
      getDashboardStream: jest.fn().mockReturnValue(of({
        videos: [],
        streams: [],
        news: [],
        trump: [],
        tweets: [],
        weather: null,
        refreshedAt: new Date(),
      })),
      getDashboard: jest.fn().mockReturnValue(of({
        videos: [],
        streams: [],
        news: [],
        trump: [],
        tweets: [],
        weather: null,
        refreshedAt: new Date(),
      })),
      refreshAll: jest.fn().mockReturnValue(refreshAllSubject.asObservable()),
      getPreferences: jest.fn().mockReturnValue(of({ customRssFeeds: '' })),
      savePreferences: jest.fn().mockReturnValue(of({})),
      refreshNews: jest.fn().mockReturnValue(of({})),
    };

    mockVideosStore = createMockStore();
    mockNewsStore = createMockStore();
    mockTrumpStore = createMockStore();
    mockStreamsStore = createMockStore();
    mockTweetsStore = createMockStore();

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
    .overrideProvider(TweetsStore, { useValue: mockTweetsStore })
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
    expect(component.tweetsStore).toBeDefined();
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
});
import { TestBed } from '@angular/core/testing';
import { ApiService } from './api.service';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';

describe('ApiService', () => {
  let service: ApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call dashboard endpoint on getDashboard', () => {
    const mockData = {
      weather: {},
      streams: [],
      videos: [],
      news: [],
      trump: [],
      refreshedAt: new Date(),
    };
    service.getDashboard().subscribe((data) => {
      expect(data).toEqual(mockData);
    });
    const req = httpTesting.expectOne('/api/dashboard');
    expect(req.request.method).toBe('GET');
    req.flush(mockData);
  });

  it('should call streams endpoint on getStreams', () => {
    service.getStreams().subscribe((data) => {
      expect(data).toEqual([]);
    });
    const req = httpTesting.expectOne('/api/streams');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should call videos endpoint on getVideos', () => {
    service.getVideos().subscribe((data) => {
      expect(data).toEqual([]);
    });
    const req = httpTesting.expectOne('/api/videos?limit=20');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should call news endpoint on getNews', () => {
    service.getNews().subscribe((data) => {
      expect(data).toEqual([]);
    });
    const req = httpTesting.expectOne(
      '/api/news?limit=20'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should call POST on savePreferences', () => {
    const prefs = { weatherCity: 'Caen' };
    service.savePreferences(prefs).subscribe((data) => {
      expect(data).toBeNull();
    });
    const req = httpTesting.expectOne(
      '/api/preferences'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(prefs);
    req.flush(null);
  });

  it('should call POST on detectFeed', () => {
    service.detectFeed('https://example.com').subscribe((data) => {
      expect(data).toEqual({ feedUrl: 'https://example.com/feed.xml' });
    });
    const req = httpTesting.expectOne(
      '/api/sites/detect-feed'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ url: 'https://example.com' });
    req.flush({ feedUrl: 'https://example.com/feed.xml' });
  });
});

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

export interface DashboardData {
  weather: any;
  market: any[];
  streams: any[];
  videos: any[];
  news: any[];
  trump: any[];
  refreshedAt: Date;
}

export interface AuthStatus {
  youtube: boolean;
  twitch: boolean;
}

export interface UserPreferences {
  weatherCity: string;
  twitchFollows: string;
  twitchUsername: string;
  youtubeChannels: string;
  youtubeChannelIds: string;
  trumpMinCriticality: number;
  customRssFeeds: string;
  refreshInterval: number;
  themeOledBlack: boolean;
  marketRefreshInterval: number;
  trumpRefreshInterval: number;
  newsRefreshInterval: number;
  streamsRefreshInterval: number;
  youtubeRefreshInterval: number;
}

export interface YoutubeRemapHandleDiagnostic {
  handle: string;
  resolvedChannelId: string | null;
  status: 'ok' | 'unresolved' | 'missingStoredId';
  storedMatch: boolean;
  lastSeenChannelName: string;
  lastSeenChannelHandle: string;
}

export interface YoutubeOrphanChannelDiagnostic {
  channelId: string;
  lastSeenChannelName: string;
  lastSeenChannelHandle: string;
}

export interface YoutubeRemapReport {
  generatedAt: string;
  handles: YoutubeRemapHandleDiagnostic[];
  orphanChannelIds: YoutubeOrphanChannelDiagnostic[];
  storedChannelIds: string[];
  resolvedChannelIds: string[];
}

export interface YoutubeChannelCandidate {
  channelId: string;
  title: string;
  handle: string;
  url: string;
  source: 'youtube-api' | 'cache';
}

export interface ExtractedNewsArticle {
  title: string;
  source: string;
  content: string;
  contentHtml?: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  private baseUrl = 'http://localhost:3000/api';
  isLoading = false;
  error: string | null = null;

  private handleError = (error: HttpErrorResponse): Observable<never> => {
    let errorMessage = 'An unknown error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      errorMessage = `Error ${error.status}: ${error.message}`;
    }
    this.error = errorMessage;
    return throwError(() => new Error(errorMessage));
  };

  getHealth(): Observable<any> {
    return this.http.get('http://localhost:3000/health').pipe(
      catchError(this.handleError)
    );
  }

  getDashboard(): Observable<DashboardData> {
    this.isLoading = true;
    this.error = null;
    return this.http.get<DashboardData>(`${this.baseUrl}/dashboard`).pipe(
      catchError(this.handleError)
    );
  }

  getDashboardStream(onProgress: (step: string) => void): Observable<DashboardData> {
    return new Observable(subscriber => {
      const es = new EventSource(`${this.baseUrl}/dashboard/stream`);
      const SSE_TIMEOUT_MS = 5000;
      let done = false;
      let timeoutId: any;

      const armTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (done) return;
          done = true;
          es.close();
          subscriber.error(new Error('SSE timeout'));
        }, SSE_TIMEOUT_MS);
      };

      armTimeout();

      es.addEventListener('progress', (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        onProgress(data.step);
        armTimeout();
      });

      es.addEventListener('heartbeat', () => {
        armTimeout();
      });

      es.addEventListener('dashboard', (event: MessageEvent) => {
        if (done) return;
        done = true;
        if (timeoutId) clearTimeout(timeoutId);
        const data = JSON.parse(event.data);
        subscriber.next(data);
        subscriber.complete();
        es.close();
      });

      es.addEventListener('error', () => {
        if (done) return;
        done = true;
        if (timeoutId) clearTimeout(timeoutId);
        es.close();
        subscriber.error(new Error('SSE connection failed'));
      });

      return () => {
        done = true;
        if (timeoutId) clearTimeout(timeoutId);
        es.close();
      };
    });
  }

  getTrumpTweets(limit: number = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/trump?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getStreams(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/streams`).pipe(
      catchError(this.handleError)
    );
  }

  getFollows(username?: string): Observable<any[]> {
    const params = username ? `?username=${encodeURIComponent(username)}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/follows${params}`).pipe(
      catchError(this.handleError)
    );
  }

  getVideos(limit: number = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/videos?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getNews(limit: number = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/news?limit=${limit}`).pipe(
      catchError(this.handleError)
    );
  }

  getMarketData(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/market/live`).pipe(
      catchError(this.handleError)
    );
  }

  extractNewsArticle(url: string): Observable<ExtractedNewsArticle> {
    return this.http.post<ExtractedNewsArticle>(`${this.baseUrl}/news/extract`, { url }).pipe(
      catchError(this.handleError)
    );
  }

  getWeather(city: string = 'Caen'): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/weather?city=${encodeURIComponent(city)}`).pipe(
      catchError(this.handleError)
    );
  }

  refreshAll(): Observable<any> {
    return this.http.post(`${this.baseUrl}/refresh/all`, {}).pipe(
      catchError(this.handleError)
    );
  }

  getAuthStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>('http://localhost:3000/api/auth/status').pipe(
      catchError(this.handleError)
    );
  }

  connectYouTube(): void {
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(
      'http://localhost:3000/api/auth/youtube',
      'YouTube OAuth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  connectTwitch(): void {
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(
      'http://localhost:3000/api/auth/twitch',
      'Twitch OAuth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  logout(provider: 'youtube' | 'twitch'): Observable<any> {
    return this.http.post('http://localhost:3000/api/auth/logout', { provider }).pipe(
      catchError(this.handleError)
    );
  }

  getPreferences(): Observable<UserPreferences> {
    return this.http.get<UserPreferences>(`${this.baseUrl}/preferences`).pipe(
      catchError(this.handleError)
    );
  }

  savePreferences(prefs: Partial<UserPreferences>): Observable<any> {
    return this.http.post(`${this.baseUrl}/preferences`, prefs).pipe(
      catchError(this.handleError)
    );
  }

  importTwitchList(channels: string[]): Observable<{ imported: number; channels: string[]; invalid: string[] }> {
    return this.http.post<{ imported: number; channels: string[]; invalid: string[] }>(
      `${this.baseUrl}/twitch/import-list`, { channels }
    ).pipe(catchError(this.handleError));
  }

  importYoutubeList(channels: string[]): Observable<{ imported: number; channels: string[] }> {
    return this.http.post<{ imported: number; channels: string[] }>(
      `${this.baseUrl}/youtube/import-list`, { channels }
    ).pipe(catchError(this.handleError));
  }

  detectFeed(url: string): Observable<{ feedUrl: string }> {
    return this.http.post<{ feedUrl: string }>(`${this.baseUrl}/sites/detect-feed`, { url }).pipe(
      catchError(this.handleError)
    );
  }

  refreshNews(): Observable<any> {
    return this.http.post(`${this.baseUrl}/refresh/news`, {}).pipe(
      catchError(this.handleError)
    );
  }

  importYoutubeTakeout(channels: { channelId: string; title: string }[]): Observable<{ imported: number; total: number }> {
    return this.http.post<{ imported: number; total: number }>(
      `${this.baseUrl}/youtube/import-takeout`, { channels }
    ).pipe(catchError(this.handleError));
  }

  getYoutubeRemapReport(): Observable<YoutubeRemapReport> {
    return this.http.get<YoutubeRemapReport>(`${this.baseUrl}/youtube/remap/report`).pipe(
      catchError(this.handleError)
    );
  }

  searchYoutubeChannels(query: string): Observable<{ query: string; candidates: YoutubeChannelCandidate[] }> {
    return this.http.get<{ query: string; candidates: YoutubeChannelCandidate[] }>(
      `${this.baseUrl}/youtube/remap/search?q=${encodeURIComponent(query)}`
    ).pipe(catchError(this.handleError));
  }

  remapYoutubeChannel(handle: string, channelId: string): Observable<{ success: boolean; handle: string; channelId: string }> {
    return this.http.post<{ success: boolean; handle: string; channelId: string }>(
      `${this.baseUrl}/youtube/remap`, { handle, channelId }
    ).pipe(catchError(this.handleError));
  }
}

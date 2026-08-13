import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { UserPreferences } from '../models';

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

// Source unique de `UserPreferences` (définie dans models/index.ts).
export type { UserPreferences };

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly origin = environment.origin;

  getHealth(): Observable<any> {
    return this.http.get(`${this.origin}/health`);
  }

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/dashboard`);
  }

  getDashboardStream(onProgress: (step: string) => void): Observable<DashboardData> {
    return new Observable(subscriber => {
      const es = new EventSource(`${this.apiUrl}/dashboard/stream`);
      // Server heartbeat is 4s and the timeout is re-armed on every
      // heartbeat/progress event, so 30s only fires when the stream is
      // genuinely stuck (e.g. server still booting). Was 5s, which failed
      // whenever the first dashboard event took longer than that.
      const SSE_TIMEOUT_MS = 30000;
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

  getTrumpTweets(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/trump?limit=${limit}`);
  }

  getStreams(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/streams`);
  }

  getFollows(username?: string): Observable<any[]> {
    const params = username ? `?username=${encodeURIComponent(username)}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/follows${params}`);
  }

  getVideos(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/videos?limit=${limit}`);
  }

  getNews(limit = 20): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/news?limit=${limit}`);
  }

  getMarketData(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/market/live`);
  }

  getMarketSentiment(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/market/sentiment`);
  }

  getMarketNews(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/market/news`);
  }

  extractNewsArticle(url: string): Observable<ExtractedNewsArticle> {
    return this.http.post<ExtractedNewsArticle>(`${this.apiUrl}/news/extract`, { url });
  }

  getWeather(city = 'Caen'): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/weather?city=${encodeURIComponent(city)}`);
  }

  refreshAll(): Observable<any> {
    return this.http.post(`${this.apiUrl}/refresh/all`, {});
  }

  getAuthStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.apiUrl}/auth/status`);
  }

  connectYouTube(): void {
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    window.open(
      `${this.apiUrl}/auth/youtube`,
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
      `${this.apiUrl}/auth/twitch`,
      'Twitch OAuth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  logout(provider: 'youtube' | 'twitch'): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, { provider });
  }

  getPreferences(): Observable<UserPreferences> {
    return this.http.get<UserPreferences>(`${this.apiUrl}/preferences`);
  }

  savePreferences(prefs: Partial<UserPreferences>): Observable<any> {
    return this.http.post(`${this.apiUrl}/preferences`, prefs);
  }

  importTwitchList(channels: string[]): Observable<{ imported: number; channels: string[]; invalid: string[] }> {
    return this.http.post<{ imported: number; channels: string[]; invalid: string[] }>(
      `${this.apiUrl}/twitch/import-list`, { channels }
    );
  }

  getTwitchPlayback(channel: string): Observable<{ auth?: string; sig?: string; expiresAt?: string; anonymous: boolean }> {
    return this.http.get<{ auth?: string; sig?: string; expiresAt?: string; anonymous: boolean }>(
      `${this.apiUrl}/twitch/playback?channel=${encodeURIComponent(channel)}`
    );
  }

  importYoutubeList(channels: string[]): Observable<{ imported: number; channels: string[] }> {
    return this.http.post<{ imported: number; channels: string[] }>(
      `${this.apiUrl}/youtube/import-list`, { channels }
    );
  }

  detectFeed(url: string): Observable<{ feedUrl: string }> {
    return this.http.post<{ feedUrl: string }>(`${this.apiUrl}/sites/detect-feed`, { url });
  }

  refreshNews(): Observable<any> {
    return this.http.post(`${this.apiUrl}/refresh/news`, {});
  }

  importYoutubeTakeout(channels: { channelId: string; title: string }[]): Observable<{ imported: number; total: number }> {
    return this.http.post<{ imported: number; total: number }>(
      `${this.apiUrl}/youtube/import-takeout`, { channels }
    );
  }

  getYoutubeRemapReport(): Observable<YoutubeRemapReport> {
    return this.http.get<YoutubeRemapReport>(`${this.apiUrl}/youtube/remap/report`);
  }

  searchYoutubeChannels(query: string): Observable<{ query: string; candidates: YoutubeChannelCandidate[] }> {
    return this.http.get<{ query: string; candidates: YoutubeChannelCandidate[] }>(
      `${this.apiUrl}/youtube/remap/search?q=${encodeURIComponent(query)}`
    );
  }

  remapYoutubeChannel(handle: string, channelId: string): Observable<{ success: boolean; handle: string; channelId: string }> {
    return this.http.post<{ success: boolean; handle: string; channelId: string }>(
      `${this.apiUrl}/youtube/remap`, { handle, channelId }
    );
  }
}

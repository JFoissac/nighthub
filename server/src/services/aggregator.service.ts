import { logger } from '../utils/logger';
import { RELEVANCE } from '../config/constants';
import { createAggregatorCronJobs } from '../jobs/aggregator.cron';
import type { WeatherService } from './weather.service';
import type { NewsService } from './news.service';
import type { YoutubeService } from './youtube.service';
import type { TwitchService } from './twitch.service';
import type { TrumpService } from './trump.service';
import type { MarketService } from './market.service';
import * as fs from 'fs';
import * as path from 'path';

export type AggregatorWeatherService = Pick<WeatherService, 'getWeeklyForecast'>;
export type AggregatorNewsService = Pick<NewsService, 'fetchAiNews' | 'getCachedNews'>;
export type AggregatorYoutubeService = Pick<
  YoutubeService,
  'fetchAndCacheLatestVideos' | 'getLatestVideos' | 'getCachedLiveStreams' | 'verifyAndCleanLiveStreams'
>;
export type AggregatorTwitchService = Pick<
  TwitchService,
  'getFollowedStreams' | 'getLiveStreamsFast' | 'refreshLiveCacheLight'
>;
export type AggregatorTrumpService = Pick<TrumpService, 'fetchTrumpTweets' | 'getCachedTrumpTweets'>;
export type AggregatorMarketService = Pick<MarketService, 'getLiveMarketData'>;

export type AggregatorServiceDeps = {
  weatherService: AggregatorWeatherService;
  newsService: AggregatorNewsService;
  youtubeService: AggregatorYoutubeService;
  twitchService: AggregatorTwitchService;
  trumpService: AggregatorTrumpService;
  marketService: AggregatorMarketService;
};

export class AggregatorService {
  private isShuttingDown = false;
  private cronJobs: { stop: () => void } | null = null;
  private dashboardCache: { data: any; fetchedAt: number } | null = null;
  private dashboardRebuildInFlight: Promise<any> | null = null;

  static readonly DASHBOARD_CACHE_TTL_MS = 30_000;
  static readonly SOURCE_TIMEOUT_MS = 3_000;
  /** Âge max des données en base pour considérer un boot « frais » (skip refresh initial). */
  static readonly BOOT_FRESH_MAX_AGE_MS = 10 * 60_000;
  /** Fichier du snapshot dashboard persistant (même pattern que le snapshot trump). */
  static readonly SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'dashboard-snapshot.json');

  constructor(private readonly deps: AggregatorServiceDeps) {
    this.loadPersistedSnapshot();
  }

  /** Charge le snapshot dashboard persistant au démarrage (rendu <100ms à froid total). */
  private loadPersistedSnapshot(): void {
    if (process.env.NODE_ENV === 'test') return; // jamais de snapshot dans les tests
    try {
      if (!fs.existsSync(AggregatorService.SNAPSHOT_FILE)) return;
      const raw = fs.readFileSync(AggregatorService.SNAPSHOT_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data && typeof parsed.fetchedAt === 'number') {
        this.dashboardCache = { data: parsed.data, fetchedAt: parsed.fetchedAt };
        logger.info('Dashboard snapshot loaded from disk', { ageMin: Math.round((Date.now() - parsed.fetchedAt) / 60000) });
      }
    } catch (err) {
      logger.warn('Failed to load dashboard snapshot', { error: (err as Error).message });
    }
  }

  /** Persiste le snapshot dashboard après un rebuild réussi. */
  private persistSnapshot(data: any): void {
    if (process.env.NODE_ENV === 'test') return; // jamais d'écriture disque dans les tests
    try {
      const dir = path.dirname(AggregatorService.SNAPSHOT_FILE);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(AggregatorService.SNAPSHOT_FILE, JSON.stringify({ data, fetchedAt: Date.now() }));
    } catch (err) {
      logger.warn('Failed to persist dashboard snapshot', { error: (err as Error).message });
    }
  }

  /**
   * Vrai si les données en base sont suffisamment fraîches pour skipper le
   * refresh initial au boot (P0 : évite 13s→3min de crawl à chaque démarrage).
   */
  async isDataFresh(maxAgeMs: number = AggregatorService.BOOT_FRESH_MAX_AGE_MS): Promise<boolean> {
    try {
      const { prisma } = await import('../db/prisma.client');
      const since = new Date(Date.now() - maxAgeMs);
      const [videos, news, tweets, streams] = await Promise.all([
        prisma.youtubeVideo.count({ where: { fetchedAt: { gte: since } } }),
        prisma.aiNewsItem.count({ where: { fetchedAt: { gte: since } } }),
        prisma.tweet.count({ where: { fetchedAt: { gte: since } } }),
        prisma.twitchStream.count({ where: { fetchedAt: { gte: since } } }),
      ]);
      // Au moins 3 sources sur 4 fraîches → on considère le boot frais.
      const fresh = [videos, news, tweets, streams].filter((n) => n > 0).length;
      return fresh >= 3;
    } catch (err) {
      logger.warn('isDataFresh check failed', { error: (err as Error).message });
      return false;
    }
  }

  private static withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Source timed out after ${ms}ms`)), ms);
      }),
    ]);
  }

  /** Returns the current dashboard snapshot without any freshness check (may be stale). */
  getDashboardSnapshot(): any | null {
    return this.dashboardCache?.data ?? null;
  }

  /** Forces the next getDashboardData() to rebuild the snapshot. */
  invalidateDashboardCache(): void {
    this.dashboardCache = null;
  }

  start(): void {
    if (this.cronJobs) {
      return;
    }
    this.cronJobs = createAggregatorCronJobs({
      aggregatorService: this,
      youtubeService: this.deps.youtubeService,
      shouldRun: () => !this.isShuttingDown,
      log: logger,
    });
    logger.info('Aggregator cron jobs started');
  }

  stop(): void {
    this.isShuttingDown = true;
    this.cronJobs?.stop();
    this.cronJobs = null;
    logger.info('Aggregator cron jobs stopped');
  }

  async refreshAll(): Promise<void> {
    try {
      // P0 : NE PAS invalider le snapshot au début — le dashboard continue de
      // servir l'ancien snapshot (stale) pendant le refresh au lieu de bloquer.
      const tasks = [
        { name: 'weather', promise: this.deps.weatherService.getWeeklyForecast('Caen') },
        { name: 'news', promise: this.deps.newsService.fetchAiNews() },
        { name: 'youtube', promise: this.deps.youtubeService.fetchAndCacheLatestVideos() },
        { name: 'twitch', promise: this.deps.twitchService.getFollowedStreams() },
        { name: 'trump', promise: this.deps.trumpService.fetchTrumpTweets(20) },
      ];
      const results = await Promise.allSettled(tasks.map(task => task.promise));
      const failures = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return null;
          }
          const reason = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          return {
            task: tasks[index].name,
            reason,
          };
        })
        .filter((failure): failure is { task: string; reason: string } => failure !== null);

      if (failures.length > 0) {
        console.warn(
          `[Aggregator] Partial data refresh failure (${failures.length}/${tasks.length}):`,
          failures,
        );
        return;
      }

      logger.info('All data refreshed successfully');
      // P0-2 : une fois le refresh réussi, invalider puis rebuild immédiatement
      // pour que le dashboard serve les données fraîches sans attendre le TTL.
      this.invalidateDashboardCache();
      await this.getDashboardData().catch((e: unknown) =>
        logger.warn('Dashboard rebuild after refresh failed', { error: (e as Error).message }));
    } catch (error) {
      logger.error('Error refreshing all data', error);
    }
  }

  async refreshTwitch(): Promise<void> {
    try {
      const result = await this.deps.twitchService.refreshLiveCacheLight();
      if (!result.changed) {
        logger.debug('Twitch check: no changes', { totalLive: result.totalLive });
        return;
      }
      logger.info('Twitch check updated', {
        newLives: result.newLives,
        endedLives: result.endedLives,
        totalLive: result.totalLive,
      });
    } catch (error) {
      logger.error('Error refreshing Twitch', error);
    }
  }

  async refreshTrump(): Promise<void> {
    try {
      await this.deps.trumpService.fetchTrumpTweets(20);
    } catch (error) {
      logger.error('Error refreshing Trump', error);
    }
  }

  calculateRelevanceScore(item: any, type: string): number {
    const now = new Date();
    let ageHours = 0;
    let maxAge: number = RELEVANCE.MAX_AGE_DEFAULT_HOURS;

    if (item.fetchedAt) {
      ageHours = (now.getTime() - new Date(item.fetchedAt).getTime()) / (1000 * 60 * 60);
    } else if (item.createdAt) {
      ageHours = (now.getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    }

    switch (type) {
      case 'video':
        maxAge = RELEVANCE.MAX_AGE_VIDEO_HOURS as number;
        break;
      case 'news':
        maxAge = RELEVANCE.MAX_AGE_NEWS_HOURS as number;
        break;
      case 'stream':
        maxAge = RELEVANCE.MAX_AGE_STREAM_HOURS as number;
        break;
      case 'trump':
        maxAge = RELEVANCE.MAX_AGE_TRUMP_HOURS as number;
        break;
      default:
        maxAge = RELEVANCE.MAX_AGE_DEFAULT_HOURS as number;
    }

    const recencyScore = Math.max(0, 1 - ageHours / maxAge);

    let engagementScore = 0;
    if (item.likes) engagementScore += Math.log10(item.likes + 1) / 10;
    if (item.retweets) engagementScore += Math.log10(item.retweets + 1) / 10;
    if (item.views) engagementScore += Math.log10(item.views + 1) / 10;
    if (item.viewerCount) engagementScore += Math.log10(item.viewerCount + 1) / 10;

    const score = RELEVANCE.RECENCY_WEIGHT * recencyScore + RELEVANCE.ENGAGEMENT_WEIGHT * engagementScore + RELEVANCE.BASE_SCORE;

    return Math.min(1, Math.max(0, score));
  }

  sortByRelevance(items: any[], type: string): any[] {
    return items
      .map(item => ({
        ...item,
        relevanceScore: this.calculateRelevanceScore(item, type),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getDashboardData(onProgress?: (step: string) => void): Promise<any> {
    const now = Date.now();

    // Fast path: serve the fresh in-memory snapshot without touching services.
    if (this.dashboardCache && now - this.dashboardCache.fetchedAt < AggregatorService.DASHBOARD_CACHE_TTL_MS) {
      onProgress?.('Done');
      return this.dashboardCache.data;
    }

    // Stale-while-revalidate: a stale snapshot is served immediately and the
    // rebuild happens in the background, so the dashboard never blocks.
    if (this.dashboardCache) {
      if (!this.dashboardRebuildInFlight) {
        this.dashboardRebuildInFlight = this.rebuildDashboard(onProgress).finally(() => {
          this.dashboardRebuildInFlight = null;
        });
      }
      onProgress?.('Done');
      return this.dashboardCache.data;
    }

    // No snapshot yet (first load): wait for the rebuild, bounded by per-source
    // timeouts so it can never stall the response for long. P1 : si un rebuild
    // est déjà en cours (pre-warm au boot), on attend celui-là au lieu d'en
    // lancer un deuxième (contention évitée).
    if (this.dashboardRebuildInFlight) {
      return this.dashboardRebuildInFlight;
    }
    this.dashboardRebuildInFlight = this.rebuildDashboard(onProgress).finally(() => {
      this.dashboardRebuildInFlight = null;
    });
    return this.dashboardRebuildInFlight;
  }

  private async rebuildDashboard(onProgress?: (step: string) => void): Promise<any> {
    try {
      const { prisma } = await import('../db/prisma.client');
      const prefs = await prisma.userPreference.findFirst();
      const weatherCity = prefs?.weatherCity || 'Caen';
      const trumpMinCriticality = prefs?.trumpMinCriticality || 0;

      onProgress?.('Loading weather...');
      onProgress?.('Loading streams, videos, news...');

      // Every external source is bounded by a hard timeout so a blocked
      // network can never stall the dashboard for long.
      const source = (promise: Promise<any>) => AggregatorService.withTimeout(promise, AggregatorService.SOURCE_TIMEOUT_MS);

      const [weather, streams, videos, news, trump, youtubeLives, market] = await Promise.allSettled([
        source(this.deps.weatherService.getWeeklyForecast(weatherCity)),
        source(this.deps.twitchService.getLiveStreamsFast(20)),
        source(this.deps.youtubeService.getLatestVideos(20)),
        source(this.deps.newsService.getCachedNews(20)),
        source(this.deps.trumpService.getCachedTrumpTweets(20)),
        source(this.deps.youtubeService.getCachedLiveStreams(10)),
        source(this.deps.marketService.getLiveMarketData()),
      ]);

      onProgress?.('Done');

      const weatherData = weather.status === 'fulfilled' ? weather.value : null;
      const twitchStreams = streams.status === 'fulfilled' && Array.isArray(streams.value) ? streams.value : [];
      const videoData = videos.status === 'fulfilled' && Array.isArray(videos.value) ? videos.value : [];
      const newsData = news.status === 'fulfilled' && Array.isArray(news.value) ? news.value : [];
      const youtubeLiveData = youtubeLives.status === 'fulfilled' && Array.isArray(youtubeLives.value) ? youtubeLives.value : [];
      const marketData = market.status === 'fulfilled' && Array.isArray(market.value) ? market.value : [];

      // Filter trump tweets by min criticality preference
      let trumpData = trump.status === 'fulfilled' && Array.isArray(trump.value) ? trump.value : [];
      if (trumpMinCriticality > 0) {
        trumpData = trumpData.filter((t: any) => t.criticality >= trumpMinCriticality);
      }

      // Merge YouTube live streams into Twitch streams
      const mergedStreams = [
        ...twitchStreams,
        ...youtubeLiveData.map((v: any) => ({
          id: v.youtubeId || v.id,
          twitchId: v.youtubeId || v.id,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          viewerCount: v.views || 0,
          channelName: v.channelName,
          channelAvatar: v.channelAvatar,
          gameName: 'YouTube Live',
          isLive: true,
          url: v.url,
        })),
      ];

      const data = {
        weather: weatherData,
        market: marketData,
        streams: mergedStreams,
        videos: this.sortByRelevance(videoData, 'video'),
        news: newsData,
        trump: trumpData,
        refreshedAt: new Date(),
      };

      this.dashboardCache = { data, fetchedAt: Date.now() };
      // P0-3 : persister le snapshot pour un rendu <100ms au prochain boot à froid.
      this.persistSnapshot(data);
      return data;
    } catch (error) {
      logger.error('Error getting dashboard data', error);
      return {
        weather: null,
        market: [],
        streams: [],
        videos: [],
        news: [],
        trump: [],
        refreshedAt: new Date(),
      };
    }
  }
}

export function createAggregatorService(deps: AggregatorServiceDeps): AggregatorService {
  return new AggregatorService(deps);
}

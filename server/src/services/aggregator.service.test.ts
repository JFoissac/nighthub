import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAggregatorService, type AggregatorServiceDeps } from './aggregator.service';

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('../jobs/aggregator.cron', () => ({
  createAggregatorCronJobs: vi.fn().mockReturnValue({
    stop: vi.fn(),
  }),
}));

import { createAggregatorCronJobs } from '../jobs/aggregator.cron';

function createDeps(): AggregatorServiceDeps {
  return {
    weatherService: {
      getWeeklyForecast: vi.fn(),
    },
    newsService: {
      fetchAiNews: vi.fn(),
      getCachedNews: vi.fn(),
    },
    youtubeService: {
      fetchAndCacheLatestVideos: vi.fn(),
      getLatestVideos: vi.fn(),
      getCachedLiveStreams: vi.fn(),
      verifyAndCleanLiveStreams: vi.fn(),
    },
    twitchService: {
      getFollowedStreams: vi.fn(),
      getLiveStreamsFast: vi.fn(),
      refreshLiveCacheLight: vi.fn(),
    },
    trumpService: {
      fetchTrumpTweets: vi.fn(),
      getCachedTrumpTweets: vi.fn(),
    },
    marketService: {
      getLiveMarketData: vi.fn(),
    },
  };
}

let deps: AggregatorServiceDeps;
let aggregatorService: ReturnType<typeof createAggregatorService>;

describe('AggregatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
    aggregatorService = createAggregatorService(deps);
  });

  describe('calculateRelevanceScore', () => {
    it('returns high score for a fresh item with no engagement (video)', () => {
      const item = { fetchedAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'video');
      expect(score).toBeCloseTo(0.7, 2);
    });

    it('returns high score for a fresh item with no engagement (news)', () => {
      const item = { fetchedAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'news');
      expect(score).toBeCloseTo(0.7, 2);
    });

    it('returns high score for a fresh item with no engagement (stream)', () => {
      const item = { fetchedAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'stream');
      expect(score).toBeCloseTo(0.7, 2);
    });

    it('returns high score for a fresh item with no engagement (trump)', () => {
      const item = { fetchedAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'trump');
      expect(score).toBeCloseTo(0.7, 2);
    });

    it('returns high score for a fresh item with no engagement (default)', () => {
      const item = { fetchedAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'tweet');
      expect(score).toBeCloseTo(0.7, 2);
    });

    it('returns base score for a very old item', () => {
      const item = { fetchedAt: new Date(Date.now() - 1000 * 60 * 60 * 500).toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'video');
      expect(score).toBeCloseTo(0.2, 2);
    });

    it('boosts score with engagement metrics', () => {
      const item = {
        fetchedAt: new Date().toISOString(),
        likes: 999,
        retweets: 999,
        views: 999,
        viewerCount: 999,
      };
      const score = aggregatorService.calculateRelevanceScore(item, 'news');
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('uses createdAt when fetchedAt is missing', () => {
      const item = { createdAt: new Date().toISOString() };
      const score = aggregatorService.calculateRelevanceScore(item, 'trump');
      expect(score).toBeCloseTo(0.7, 2);
    });
  });

  describe('cron lifecycle', () => {
    it('creates cron jobs once and stops them on shutdown', () => {
      const stop = vi.fn();
      (createAggregatorCronJobs as any).mockReturnValue({ stop });

      aggregatorService.start();
      aggregatorService.start();

      expect(createAggregatorCronJobs).toHaveBeenCalledTimes(1);
      expect(createAggregatorCronJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatorService,
          youtubeService: deps.youtubeService,
        }),
      );

      aggregatorService.stop();
      expect(stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('sortByRelevance', () => {
    it('orders items by descending relevance score', () => {
      const items = [
        { fetchedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(), views: 0 },
        { fetchedAt: new Date().toISOString(), views: 10000 },
        { fetchedAt: new Date().toISOString(), views: 0 },
      ];
      const sorted = aggregatorService.sortByRelevance(items, 'video');
      expect(sorted[0].relevanceScore).toBeGreaterThanOrEqual(sorted[1].relevanceScore);
      expect(sorted[1].relevanceScore).toBeGreaterThanOrEqual(sorted[2].relevanceScore);
    });
  });

  describe('refreshAll', () => {
    it('calls all underlying services', async () => {
      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue({});
      (deps.newsService.fetchAiNews as any).mockResolvedValue([]);
      (deps.youtubeService.fetchAndCacheLatestVideos as any).mockResolvedValue(undefined);
      (deps.twitchService.getFollowedStreams as any).mockResolvedValue([]);
      (deps.trumpService.fetchTrumpTweets as any).mockResolvedValue([]);

      await aggregatorService.refreshAll();

      expect(deps.weatherService.getWeeklyForecast).toHaveBeenCalledWith('Caen');
      expect(deps.newsService.fetchAiNews).toHaveBeenCalled();
      expect(deps.youtubeService.fetchAndCacheLatestVideos).toHaveBeenCalled();
      expect(deps.twitchService.getFollowedStreams).toHaveBeenCalled();
      expect(deps.trumpService.fetchTrumpTweets).toHaveBeenCalledWith(20);
    });

    it('logs partial failure summary when some refresh tasks reject', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue({});
      (deps.newsService.fetchAiNews as any).mockRejectedValue(new Error('news failed'));
      (deps.youtubeService.fetchAndCacheLatestVideos as any).mockResolvedValue(undefined);
      (deps.twitchService.getFollowedStreams as any).mockRejectedValue('twitch failed');
      (deps.trumpService.fetchTrumpTweets as any).mockResolvedValue([]);

      await aggregatorService.refreshAll();

      expect(warnSpy).toHaveBeenCalledWith(
        '[Aggregator] Partial data refresh failure (2/5):',
        [
          { task: 'news', reason: 'news failed' },
          { task: 'twitch', reason: 'twitch failed' },
        ],
      );
      expect(logSpy).not.toHaveBeenCalledWith('[Aggregator] All data refreshed successfully');
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('refreshTwitch', () => {
    it('calls twitchService.refreshLiveCacheLight', async () => {
      (deps.twitchService.refreshLiveCacheLight as any).mockResolvedValue({
        changed: false,
        newLives: 0,
        endedLives: 0,
        totalLive: 0,
      });
      await aggregatorService.refreshTwitch();
      expect(deps.twitchService.refreshLiveCacheLight).toHaveBeenCalled();
    });
  });

  describe('refreshTrump', () => {
    it('calls trumpService.fetchTrumpTweets', async () => {
      (deps.trumpService.fetchTrumpTweets as any).mockResolvedValue([]);
      await aggregatorService.refreshTrump();
      expect(deps.trumpService.fetchTrumpTweets).toHaveBeenCalledWith(20);
    });
  });

  describe('getDashboardData', () => {
    it('uses fast Twitch path in dashboard composition and avoids heavy Twitch fetch', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue(null);
      (deps.twitchService.getLiveStreamsFast as any).mockResolvedValue([]);
      (deps.youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (deps.youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (deps.newsService.getCachedNews as any).mockResolvedValue([]);
      (deps.trumpService.getCachedTrumpTweets as any).mockResolvedValue([]);

      await aggregatorService.getDashboardData();

      expect(deps.twitchService.getLiveStreamsFast).toHaveBeenCalledWith(20);
      expect(deps.twitchService.getFollowedStreams).not.toHaveBeenCalled();
    });

    it('returns the expected structure with all sections', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ weatherCity: 'Paris', trumpMinCriticality: 0 });

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue({ city: 'Paris', days: [] });
      (deps.twitchService.getLiveStreamsFast as any).mockResolvedValue([{ title: 'stream1' }]);
      (deps.youtubeService.getLatestVideos as any).mockResolvedValue([{ title: 'video1', views: 100, fetchedAt: new Date().toISOString() }]);
      (deps.youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (deps.newsService.getCachedNews as any).mockResolvedValue([{ title: 'news1', fetchedAt: new Date().toISOString() }]);
      (deps.trumpService.getCachedTrumpTweets as any).mockResolvedValue([{ content: 'trump1', criticality: 3 }]);

      const result = await aggregatorService.getDashboardData();

      expect(result.weather).toEqual({ city: 'Paris', days: [] });
      expect(deps.twitchService.getLiveStreamsFast).toHaveBeenCalledWith(20);
      expect(result.streams).toHaveLength(1);
      expect(result.videos).toHaveLength(1);
      expect(result.news).toHaveLength(1);
      expect(result.trump).toHaveLength(1);
      expect(result.refreshedAt).toBeInstanceOf(Date);
    });

    it('handles null fulfilled Twitch and YouTube live payloads safely without falling back whole response', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue({ city: 'Caen', days: [] });
      (deps.twitchService.getLiveStreamsFast as any).mockResolvedValue(null);
      (deps.youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (deps.youtubeService.getCachedLiveStreams as any).mockResolvedValue(null);
      (deps.newsService.getCachedNews as any).mockResolvedValue([{ title: 'still-here' }]);
      (deps.trumpService.getCachedTrumpTweets as any).mockResolvedValue([]);

      const result = await aggregatorService.getDashboardData();
      expect(result.streams).toEqual([]);
      expect(result.news).toEqual([{ title: 'still-here' }]);
      expect(result.weather).toEqual({ city: 'Caen', days: [] });
    });

    it('calls onProgress with steps', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue(null);
      (deps.twitchService.getLiveStreamsFast as any).mockResolvedValue([]);
      (deps.youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (deps.youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (deps.newsService.getCachedNews as any).mockResolvedValue([]);
      (deps.trumpService.getCachedTrumpTweets as any).mockResolvedValue([]);

      const progressSteps: string[] = [];
      await aggregatorService.getDashboardData((step) => progressSteps.push(step));

      expect(progressSteps).toContain('Loading weather...');
      expect(progressSteps).toContain('Loading streams, videos, news...');
      expect(progressSteps).toContain('Done');
    });

    it('filters trump tweets by trumpMinCriticality', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ weatherCity: 'Caen', trumpMinCriticality: 5 });

      (deps.weatherService.getWeeklyForecast as any).mockResolvedValue(null);
      (deps.twitchService.getLiveStreamsFast as any).mockResolvedValue([]);
      (deps.youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (deps.youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (deps.newsService.getCachedNews as any).mockResolvedValue([]);

      const trumpTweets = [
        { content: 'low', criticality: 2 },
        { content: 'medium', criticality: 5 },
        { content: 'high', criticality: 8 },
      ];
      (deps.trumpService.getCachedTrumpTweets as any).mockResolvedValue(trumpTweets);

      const result = await aggregatorService.getDashboardData();
      expect(result.trump).toHaveLength(2);
      expect(result.trump.map((t: any) => t.criticality)).toEqual([5, 8]);
    });

    it('returns fallback structure on error', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockRejectedValue(new Error('DB error'));

      const result = await aggregatorService.getDashboardData();

      expect(result.weather).toBeNull();
      expect(result.streams).toEqual([]);
      expect(result.videos).toEqual([]);
      expect(result.news).toEqual([]);
      expect(result.trump).toEqual([]);
      expect(result.refreshedAt).toBeInstanceOf(Date);
    });
  });
});

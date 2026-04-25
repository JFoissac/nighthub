import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}));

vi.mock('rss-parser', () => ({
  default: function () {
    return { parseURL: vi.fn().mockResolvedValue({ items: [] }) };
  } as any,
}));

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('./weather.service', () => ({
  weatherService: {
    getWeeklyForecast: vi.fn(),
  },
}));

vi.mock('./news.service', () => ({
  newsService: {
    fetchAiNews: vi.fn(),
    getCachedNews: vi.fn(),
    detectFeed: vi.fn(),
    validateFeedUrl: vi.fn(),
  },
}));

vi.mock('./twitter.service', () => ({
  twitterService: {
    getTimeline: vi.fn(),
    getTwitterAccounts: vi.fn(),
  },
}));

vi.mock('./youtube.service', () => ({
  youtubeService: {
    fetchAndCacheLatestVideos: vi.fn(),
    getLatestVideos: vi.fn(),
    getCachedLiveStreams: vi.fn(),
    getChannelHandles: vi.fn(),
    getChannelIds: vi.fn(),
    saveChannelHandles: vi.fn(),
    saveChannelIds: vi.fn(),
  },
}));

vi.mock('./twitch.service', () => ({
  twitchService: {
    getFollowedStreams: vi.fn(),
    getFollows: vi.fn(),
    getFollowsByProfile: vi.fn(),
    importFollowsFromList: vi.fn(),
  },
}));

vi.mock('./trump.service', () => ({
  trumpService: {
    fetchTrumpTweets: vi.fn(),
    getCachedTrumpTweets: vi.fn(),
  },
}));

import { aggregatorService } from './aggregator.service';
import { weatherService } from './weather.service';
import { newsService } from './news.service';
import { twitterService } from './twitter.service';
import { youtubeService } from './youtube.service';
import { twitchService } from './twitch.service';
import { trumpService } from './trump.service';

describe('AggregatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      (weatherService.getWeeklyForecast as any).mockResolvedValue({});
      (newsService.fetchAiNews as any).mockResolvedValue([]);
      (twitterService.getTimeline as any).mockResolvedValue([]);
      (youtubeService.fetchAndCacheLatestVideos as any).mockResolvedValue(undefined);
      (twitchService.getFollowedStreams as any).mockResolvedValue([]);
      (trumpService.fetchTrumpTweets as any).mockResolvedValue([]);

      await aggregatorService.refreshAll();

      expect(weatherService.getWeeklyForecast).toHaveBeenCalledWith('Caen');
      expect(newsService.fetchAiNews).toHaveBeenCalled();
      // Twitter/Nitter disabled — no longer called
      // expect(twitterService.getTimeline).toHaveBeenCalledWith(20);
      expect(youtubeService.fetchAndCacheLatestVideos).toHaveBeenCalled();
      expect(twitchService.getFollowedStreams).toHaveBeenCalled();
      expect(trumpService.fetchTrumpTweets).toHaveBeenCalledWith(20);
    });
  });

  describe('refreshTwitch', () => {
    it('calls twitchService.getFollowedStreams', async () => {
      (twitchService.getFollowedStreams as any).mockResolvedValue([]);
      await aggregatorService.refreshTwitch();
      expect(twitchService.getFollowedStreams).toHaveBeenCalled();
    });
  });

  describe('refreshTrump', () => {
    it('calls trumpService.fetchTrumpTweets', async () => {
      (trumpService.fetchTrumpTweets as any).mockResolvedValue([]);
      await aggregatorService.refreshTrump();
      expect(trumpService.fetchTrumpTweets).toHaveBeenCalledWith(20);
    });
  });

  describe('getDashboardData', () => {
    it('returns the expected structure with all sections', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ weatherCity: 'Paris', trumpMinCriticality: 0 });

      (weatherService.getWeeklyForecast as any).mockResolvedValue({ city: 'Paris', days: [] });
      (twitchService.getFollowedStreams as any).mockResolvedValue([{ title: 'stream1' }]);
      (youtubeService.getLatestVideos as any).mockResolvedValue([{ title: 'video1', views: 100, fetchedAt: new Date().toISOString() }]);
      (youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (newsService.getCachedNews as any).mockResolvedValue([{ title: 'news1', fetchedAt: new Date().toISOString() }]);
      (trumpService.getCachedTrumpTweets as any).mockResolvedValue([{ content: 'trump1', criticality: 3 }]);
      (twitterService.getTimeline as any).mockResolvedValue([{ content: 'tweet1', createdAt: new Date().toISOString() }]);

      const result = await aggregatorService.getDashboardData();

      expect(result.weather).toEqual({ city: 'Paris', days: [] });
      expect(result.streams).toHaveLength(1);
      expect(result.videos).toHaveLength(1);
      expect(result.news).toHaveLength(1);
      expect(result.trump).toHaveLength(1);
      expect(result.tweets).toHaveLength(0); // Twitter/Nitter disabled
      expect(result.refreshedAt).toBeInstanceOf(Date);
    });

    it('calls onProgress with steps', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);

      (weatherService.getWeeklyForecast as any).mockResolvedValue(null);
      (twitchService.getFollowedStreams as any).mockResolvedValue([]);
      (youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (newsService.getCachedNews as any).mockResolvedValue([]);
      (trumpService.getCachedTrumpTweets as any).mockResolvedValue([]);
      (twitterService.getTimeline as any).mockResolvedValue([]);

      const progressSteps: string[] = [];
      await aggregatorService.getDashboardData((step) => progressSteps.push(step));

      expect(progressSteps).toContain('Loading weather...');
      expect(progressSteps).toContain('Loading streams, videos, news...');
      expect(progressSteps).toContain('Done');
    });

    it('filters trump tweets by trumpMinCriticality', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ weatherCity: 'Caen', trumpMinCriticality: 5 });

      (weatherService.getWeeklyForecast as any).mockResolvedValue(null);
      (twitchService.getFollowedStreams as any).mockResolvedValue([]);
      (youtubeService.getLatestVideos as any).mockResolvedValue([]);
      (youtubeService.getCachedLiveStreams as any).mockResolvedValue([]);
      (newsService.getCachedNews as any).mockResolvedValue([]);
      (twitterService.getTimeline as any).mockResolvedValue([]);

      const trumpTweets = [
        { content: 'low', criticality: 2 },
        { content: 'medium', criticality: 5 },
        { content: 'high', criticality: 8 },
      ];
      (trumpService.getCachedTrumpTweets as any).mockResolvedValue(trumpTweets);

      const result = await aggregatorService.getDashboardData();
      expect(result.trump).toHaveLength(2);
      expect(result.trump.map((t: any) => t.criticality)).toEqual([5, 8]);
    });

    it('returns fallback structure on error', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockRejectedValue(new Error('DB error'));

      const result = await aggregatorService.getDashboardData();

      expect(result.weather).toBeNull();
      expect(result.tweets).toEqual([]);
      expect(result.streams).toEqual([]);
      expect(result.videos).toEqual([]);
      expect(result.news).toEqual([]);
      expect(result.trump).toEqual([]);
      expect(result.refreshedAt).toBeInstanceOf(Date);
    });
  });
});

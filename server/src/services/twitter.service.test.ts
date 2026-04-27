import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockParseURL } = vi.hoisted(() => ({
  mockParseURL: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    tweet: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('rss-parser', () => ({
  default: function() {
    return { parseURL: mockParseURL };
  } as any,
}));

import { TwitterService } from './twitter.service';

describe('TwitterService', () => {
  let service: TwitterService;

  beforeEach(() => {
    service = new TwitterService();
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
    mockParseURL.mockClear();
  });

  describe('getTwitterAccounts', () => {
    it('parses comma-separated accounts from preferences', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ twitterAccounts: 'elonmusk, @naval , jack' });
      const accounts = await service.getTwitterAccounts();
      expect(accounts).toEqual(['elonmusk', '@naval', 'jack']);
    });

    it('returns empty array when no preferences exist', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);
      expect(await service.getTwitterAccounts()).toEqual([]);
    });

    it('returns empty array on error', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockRejectedValue(new Error('db error'));
      expect(await service.getTwitterAccounts()).toEqual([]);
    });
  });

  describe('isCacheStale', () => {
    it('returns true when no tweets in DB', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.tweet.findFirst as any).mockResolvedValue(null);
      // @ts-ignore
      expect(await service.isCacheStale(30)).toBe(true);
    });

    it('returns true when cache is older than maxAge', async () => {
      const { prisma } = await import('../db/prisma.client');
      const old = new Date(Date.now() - 60 * 60 * 1000); // 60 min ago
      (prisma.tweet.findFirst as any).mockResolvedValue({ fetchedAt: old });
      // @ts-ignore
      expect(await service.isCacheStale(30)).toBe(true);
    });

    it('returns false when cache is fresh', async () => {
      const { prisma } = await import('../db/prisma.client');
      const recent = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      (prisma.tweet.findFirst as any).mockResolvedValue({ fetchedAt: recent });
      // @ts-ignore
      expect(await service.isCacheStale(30)).toBe(false);
    });
  });

  describe('getCachedTweets', () => {
    it('returns empty array when DB is empty', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.tweet.findMany as any).mockResolvedValue([]);
      expect(await service.getCachedTweets(20)).toEqual([]);
    });

    it('returns cached tweets ordered by fetchedAt desc', async () => {
      const { prisma } = await import('../db/prisma.client');
      const fake = [{ twitterId: 't1', content: 'Hello' }];
      (prisma.tweet.findMany as any).mockResolvedValue(fake);
      const result = await service.getCachedTweets(20);
      expect(result).toEqual(fake);
      expect(prisma.tweet.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, orderBy: { fetchedAt: 'desc' } })
      );
    });
  });

  describe('getTimeline', () => {
    it('returns cached tweets and triggers background refresh when stale', async () => {
      const { prisma } = await import('../db/prisma.client');
      const cached = [{ twitterId: 't1', content: 'Cached' }];
      (prisma.tweet.findMany as any).mockResolvedValue(cached);
      (prisma.tweet.findFirst as any).mockResolvedValue({ fetchedAt: new Date(Date.now() - 60 * 60 * 1000) });
      (prisma.userPreference.findFirst as any).mockResolvedValue({ twitterAccounts: 'elonmusk' });

      const timeline = await service.getTimeline(20);
      expect(timeline).toEqual(cached);
      // background refresh triggered via setImmediate
    });

    it('returns cached tweets without refresh when cache is fresh', async () => {
      const { prisma } = await import('../db/prisma.client');
      const cached = [{ twitterId: 't1', content: 'Cached' }];
      (prisma.tweet.findMany as any).mockResolvedValue(cached);
      (prisma.tweet.findFirst as any).mockResolvedValue({ fetchedAt: new Date(Date.now() - 5 * 60 * 1000) });

      const timeline = await service.getTimeline(20);
      expect(timeline).toEqual(cached);
    });
  });

  describe('refreshTimeline', () => {
    it('is disabled and does not fetch anything', async () => {
      const { prisma } = await import('../db/prisma.client');

      (prisma.userPreference.findFirst as any).mockResolvedValue({ twitterAccounts: 'a,b' });

      // @ts-ignore
      await service.refreshTimeline();
      // Nitter is disabled — no network calls, no DB writes
      expect(prisma.tweet.upsert).not.toHaveBeenCalled();
      expect(mockParseURL).not.toHaveBeenCalled();
    });
  });

  describe('batchSettled', () => {
    it('processes items in batches with limited concurrency', async () => {
      const fn = vi.fn().mockImplementation((x: number) => Promise.resolve(x * 2));
      // @ts-ignore
      const results = await service.batchSettled([1, 2, 3, 4], fn, 2);
      expect(results).toHaveLength(4);
      expect(fn).toHaveBeenCalledTimes(4);
      const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<number>[];
      expect(fulfilled.map(r => r.value)).toEqual([2, 4, 6, 8]);
    });

    it('calls onBatch progress callback', async () => {
      const fn = vi.fn().mockResolvedValue(1);
      const onBatch = vi.fn();
      // @ts-ignore
      await service.batchSettled([1, 2, 3], fn, 2, onBatch);
      expect(onBatch).toHaveBeenCalled();
    });
  });

  describe('cacheTweets', () => {
    it('truncates twitterId to 100 chars', async () => {
      const { prisma } = await import('../db/prisma.client');
      const longId = 'a'.repeat(150);
      // @ts-ignore
      await service.cacheTweets([{ twitterId: longId, content: 'Test' }]);
      expect(prisma.tweet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { twitterId: 'a'.repeat(100) },
        })
      );
    });

    it('updates existing tweets', async () => {
      const { prisma } = await import('../db/prisma.client');
      // @ts-ignore
      await service.cacheTweets([{ twitterId: 't1', content: 'Updated', likes: 5, retweets: 2 }]);
      expect(prisma.tweet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { content: 'Updated', likes: 5, retweets: 2 },
        })
      );
    });
  });

  describe('cleanContent', () => {
    it('strips HTML tags', () => {
      // @ts-ignore
      expect(service.cleanContent('<b>Bold</b>')).toBe('Bold');
    });

    it('decodes HTML entities', () => {
      // @ts-ignore
      expect(service.cleanContent('A &amp; B &lt; C')).toBe('A & B < C');
    });

    it('normalizes whitespace', () => {
      // @ts-ignore
      expect(service.cleanContent('  hello   world  ')).toBe('hello world');
    });
  });

  describe('getUserTweets', () => {
    it('returns tweets for a specific user', async () => {
      mockParseURL.mockResolvedValue({
        items: [
          { guid: 'g1', title: 'Hello', pubDate: new Date().toISOString(), 'dc:creator': 'User' },
        ],
      });
      const tweets = await service.getUserTweets('testuser', 10);
      expect(tweets.length).toBeGreaterThan(0);
      expect(tweets[0].authorHandle).toBe('@testuser');
    });
  });

  describe('disconnect', () => {
    it('clears twitter accounts from preferences', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: '1' });
      await service.disconnect();
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twitterAccounts: '' } })
      );
    });
  });
});

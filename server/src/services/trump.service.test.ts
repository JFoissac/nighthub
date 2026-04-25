import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma before importing service
vi.mock('../db/prisma.client', () => ({
  prisma: {
    trumpTweet: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Mock rss-parser
vi.mock('rss-parser', () => ({
  default: function() {
    return { parseURL: vi.fn().mockResolvedValue({ items: [] }) };
  } as any,
}));

import { TrumpService } from './trump.service';

describe('TrumpService', () => {
  let service: TrumpService;

  beforeEach(() => {
    service = new TrumpService();
  });

  describe('analyzeItem — criticality scoring', () => {
    it('scores 0 for neutral empty content', () => {
      const result = service.analyzeTweet({ title: '', contentSnippet: '' });
      expect(result.criticality).toBe(0);
    });

    it('scores high for nuclear keyword', () => {
      const result = service.analyzeTweet({ title: 'Nuclear threat from Iran!', contentSnippet: '' });
      expect(result.criticality).toBeGreaterThanOrEqual(3);
    });

    it('scores medium for trade/economy keywords', () => {
      const result = service.analyzeTweet({ title: 'New trade deal with China on economy', contentSnippet: '' });
      expect(result.criticality).toBeGreaterThanOrEqual(2);
    });

    it('caps criticality at 10', () => {
      const heavyContent = 'nuclear war attack troops military invasion emergency martial law missiles bomb sanctions';
      const result = service.analyzeTweet({ title: heavyContent, contentSnippet: heavyContent });
      expect(result.criticality).toBeLessThanOrEqual(10);
    });

    it('marks isBreaking when criticality >= 7', () => {
      const result = service.analyzeTweet({
        title: 'nuclear war emergency military attack invasion!!',
        contentSnippet: 'troops missiles bomb sanctions iran',
      });
      if (result.criticality >= 7) {
        expect(result.isBreaking).toBe(true);
      } else {
        expect(result.isBreaking).toBe(false);
      }
    });
  });

  describe('sentiment analysis', () => {
    it('returns negative for disaster content', () => {
      const result = service.analyzeTweet({ title: 'This is a disaster and terrible fraud!', contentSnippet: '' });
      expect(result.sentiment).toBe('negative');
    });

    it('returns positive for winning content', () => {
      const result = service.analyzeTweet({ title: 'Tremendous winning, great victory, incredible achievement', contentSnippet: '' });
      expect(result.sentiment).toBe('positive');
    });

    it('returns neutral for balanced or empty content', () => {
      const result = service.analyzeTweet({ title: 'Meeting today at the White House', contentSnippet: '' });
      expect(result.sentiment).toBe('neutral');
    });
  });

  describe('type classification', () => {
    it('classifies executive order tweets as decision', () => {
      const result = service.analyzeTweet({ title: 'Just signed an executive order', contentSnippet: '' });
      expect(result.type).toBe('decision');
    });

    it('classifies indicted tweets as scandal', () => {
      const result = service.analyzeTweet({ title: 'Investigation into indicted officials', contentSnippet: '' });
      expect(result.type).toBe('scandal');
    });

    it('classifies generic tweets as tweet', () => {
      const result = service.analyzeTweet({ title: 'Hello world', contentSnippet: '' });
      expect(result.type).toBe('tweet');
    });
  });

  describe('keyword extraction', () => {
    it('extracts known keywords from content', () => {
      const result = service.analyzeTweet({ title: 'nuclear war tariff china sanctions', contentSnippet: '' });
      expect(result.keywords).toContain('nuclear');
      expect(result.keywords).toContain('china');
    });

    it('limits keywords to 5', () => {
      const result = service.analyzeTweet({
        title: 'nuclear war tariff china sanctions russia iran military troops',
        contentSnippet: '',
      });
      const kws = result.keywords.split(',').filter(Boolean);
      expect(kws.length).toBeLessThanOrEqual(5);
    });
  });

  describe('content cleaning', () => {
    it('strips HTML tags from content', () => {
      const result = service.analyzeTweet({ title: '<b>Bold</b> <i>italic</i>', contentSnippet: '' });
      expect(result.content).not.toContain('<b>');
      expect(result.content).toContain('Bold');
    });

    it('decodes HTML entities', () => {
      const result = service.analyzeTweet({ title: 'Cats &amp; Dogs &lt;3', contentSnippet: '' });
      expect(result.content).toContain('Cats & Dogs');
    });
  });

  describe('URL transformation', () => {
    it('converts nitter URLs to x.com URLs', () => {
      const result = service.analyzeTweet({
        title: 'Test',
        contentSnippet: '',
        link: 'https://nitter.net/realDonaldTrump/status/123456789',
        guid: 'https://nitter.net/realDonaldTrump/status/123456789',
      });
      expect(result.url).toContain('x.com');
    });
  });

  describe('getCachedTrumpTweets', () => {
    it('returns empty array when DB is empty', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.trumpTweet.findMany as any).mockResolvedValueOnce([]);
      const result = await service.getCachedTrumpTweets(10);
      expect(result).toEqual([]);
    });

    it('returns cached tweets from DB', async () => {
      const { prisma } = await import('../db/prisma.client');
      const fakeTweets = [
        { id: '1', tweetId: 'abc', content: 'Test tweet', criticality: 5, sentiment: 'neutral', type: 'tweet', isBreaking: false },
      ];
      (prisma.trumpTweet.findMany as any).mockResolvedValueOnce(fakeTweets);
      const result = await service.getCachedTrumpTweets(10);
      expect(result).toHaveLength(1);
      expect(result[0].tweetId).toBe('abc');
    });
  });
});

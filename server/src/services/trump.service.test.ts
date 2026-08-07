import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock Prisma before importing service
vi.mock('../db/prisma.client', () => ({
  prisma: {
    trumpTweet: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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
  let tempDir: string | null = null;

  beforeEach(() => {
    process.env.TRUMP_DISABLE_ARCHIVE_FALLBACK = 'true';
    service = new TrumpService();
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    delete process.env.TRUMP_DISABLE_ARCHIVE_FALLBACK;
    delete process.env.TRUMP_ARCHIVE_DATASET_PATH;
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

  describe('truth social payload enrichment', () => {
    it('captures media urls and flags image-only posts', () => {
      const result = (service as any).analyzeTruthSocialPost({
        id: '123',
        content: '',
        media_attachments: [
          { type: 'image', url: 'https://cdn.example.com/a.jpg', preview_url: 'https://cdn.example.com/p.jpg' },
        ],
      });

      expect(result.mediaType).toBe('image');
      expect(result.mediaUrls).toContain('https://cdn.example.com/a.jpg');
      expect(result.isImageOnly).toBe(true);
      expect(result.criticality).toBe(0);
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

  describe('enrichWithAi', () => {
    const savedEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...savedEnv };
      delete process.env.TRUMP_AI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    });

    afterEach(() => {
      process.env = savedEnv;
      vi.unstubAllGlobals();
    });

    it('returns posts unchanged when no API key is configured', async () => {
      const posts = [{ tweetId: '1', content: 'hello' }];
      const out = await (service as any).enrichWithAi(posts);
      expect(out).toBe(posts);
      expect(out[0].aiRelevance).toBeUndefined();
    });

    it('merges AI analysis into posts when a key is configured', async () => {
      process.env.TRUMP_AI_API_KEY = 'sk-test';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([
            { index: 0, relevance: 9, summary: 'Frappe annoncée', reason: 'Majeur', breaking: true },
          ]) } }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const posts = [{ tweetId: '1', content: 'We launched strikes', criticality: 7 }];
      const out = await (service as any).enrichWithAi(posts);
      expect(out[0].aiRelevance).toBe(9);
      expect(out[0].aiSummary).toBe('Frappe annoncée');
      expect(out[0].criticality).toBe(7); // la criticité existante est conservée
      vi.unstubAllGlobals();
    });
  });

  describe('sortByRelevance', () => {
    it('sorts by criticality when AI is disabled', () => {
      const out = (service as any).sortByRelevance([
        { tweetId: 'a', criticality: 3 },
        { tweetId: 'b', criticality: 9 },
      ]);
      expect(out.map((t: any) => t.tweetId)).toEqual(['b', 'a']);
    });

    it('puts AI breaking first, then AI relevance, then criticality', () => {
      process.env.TRUMP_AI_API_KEY = 'sk-test';
      const out = (service as any).sortByRelevance([
        { tweetId: 'a', criticality: 9, aiRelevance: 3 },
        { tweetId: 'b', criticality: 2, aiRelevance: 8, aiBreaking: true },
        { tweetId: 'c', criticality: 7, aiRelevance: 6 },
      ]);
      expect(out.map((t: any) => t.tweetId)).toEqual(['b', 'c', 'a']);
      delete process.env.TRUMP_AI_API_KEY;
    });
  });

  describe('getCachedTrumpTweets with AI active', () => {
    afterEach(() => {
      delete process.env.TRUMP_AI_API_KEY;
    });

    it('filters low-relevance posts and ranks by AI relevance', async () => {
      process.env.TRUMP_AI_API_KEY = 'sk-test';
      process.env.TRUMP_AI_MIN_RELEVANCE = '2';
      const { prisma } = await import('../db/prisma.client');
      const fakeTweets = [
        { id: '1', tweetId: 'a', content: 'Merci pour le soutien !', criticality: 2, sentiment: 'positive', type: 'tweet', isBreaking: false, aiRelevance: 1 },
        { id: '2', tweetId: 'b', content: 'Nouvelle frappe militaire', criticality: 8, sentiment: 'neutral', type: 'tweet', isBreaking: true, aiRelevance: 9 },
        { id: '3', tweetId: 'c', content: 'Résultat du procès', criticality: 6, sentiment: 'neutral', type: 'scandal', isBreaking: false, aiRelevance: 5 },
      ];
      (prisma.trumpTweet.findMany as any).mockResolvedValueOnce(fakeTweets);

      const result = await service.getCachedTrumpTweets(10);
      expect(result.map((t: any) => t.tweetId)).toEqual(['b', 'c']); // 'a' filtré (relevance 1 < min 2)
      delete process.env.TRUMP_AI_MIN_RELEVANCE;
    });

    it('keeps chronological order when no tweet has AI scores yet', async () => {
      process.env.TRUMP_AI_API_KEY = 'sk-test';
      const { prisma } = await import('../db/prisma.client');
      const fakeTweets = [
        { id: '1', tweetId: 'a', content: 'Old', criticality: 2, sentiment: 'neutral', type: 'tweet', isBreaking: false, aiRelevance: 0 },
        { id: '2', tweetId: 'b', content: 'New', criticality: 8, sentiment: 'neutral', type: 'tweet', isBreaking: true, aiRelevance: 0 },
      ];
      (prisma.trumpTweet.findMany as any).mockResolvedValueOnce(fakeTweets);

      const result = await service.getCachedTrumpTweets(10);
      expect(result).toHaveLength(2); // aucun filtre appliqué
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

    it('falls back to the local archive when cache is empty', async () => {
      tempDir = mkdtempSync(join(tmpdir(), 'trump-fallback-'));
      const archivePath = join(tempDir, 'tweets.csv');
      writeFileSync(
        archivePath,
        [
          'date,text,platform,favorite_count,repost_count',
          '"2025-12-31 21:54:21+00:00","Congratulations to everyone, great rally tonight, thank you!",Truth Social,10,2',
          '"2025-12-31 20:55:30+00:00","We launch bomb on Iran and respond immediately with missiles.",Truth Social,1000,500',
        ].join('\n'),
      );
      delete process.env.TRUMP_DISABLE_ARCHIVE_FALLBACK;
      process.env.TRUMP_ARCHIVE_DATASET_PATH = archivePath;

      const { prisma } = await import('../db/prisma.client');
      (prisma.trumpTweet.findMany as any).mockResolvedValueOnce([]);

      const result = await service.getCachedTrumpTweets(2);

      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('local-archive');
      expect(result[1].criticality).toBeGreaterThanOrEqual(8);
    });
  });
});

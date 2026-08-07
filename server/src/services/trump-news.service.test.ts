import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../db/prisma.client', () => ({
  prisma: {
    trumpNewsItem: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('rss-parser', () => ({
  default: function () {
    return { parseURL: vi.fn().mockResolvedValue({ items: [] }) };
  } as any,
}));

import { TrumpNewsService, isTrumpNewsRelevant, getConfiguredFeeds } from './trump-news.service';
import { scoreTrumpNewsHeuristically } from './trump.ai';

describe('isTrumpNewsRelevant — filtrage des dépêches', () => {
  it('keeps items mentioning Trump by name', () => {
    expect(isTrumpNewsRelevant('Trump s\'exprime depuis la Maison Blanche', '')).toBe(true);
    expect(isTrumpNewsRelevant('Meeting MAGA de Donald Trump', '')).toBe(true);
  });

  it('keeps a grave event co-occurring with US political context', () => {
    expect(isTrumpNewsRelevant('Tirs lors d\'un rassemblement', 'Le président a été évacué')).toBe(true);
  });

  it('drops unrelated news', () => {
    expect(isTrumpNewsRelevant('Les résultats du championnat de foot', '')).toBe(false);
    expect(isTrumpNewsRelevant('Tirs en zone rurale', '')).toBe(false);
  });

  it('drops grave events without US political context', () => {
    expect(isTrumpNewsRelevant('Fusillade dans une école au Brésil', '')).toBe(false);
  });
});

describe('TrumpNewsService', () => {
  let service: TrumpNewsService;
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...savedEnv };
    delete process.env.TRUMP_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    service = new TrumpNewsService();
    vi.clearAllMocks();
    // Repart d'un état propre : findMany renvoie [] par défaut.
    const { prisma } = await import('../db/prisma.client');
    (prisma.trumpNewsItem.findMany as any).mockReset();
    (prisma.trumpNewsItem.findMany as any).mockResolvedValue([]);
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  describe('fetchSingleFeed', () => {
    it('filters feed items and keeps only Trump-relevant ones', async () => {
      const feed = { url: 'https://example.com/rss', source: 'testmedia' };
      const parser = (service as any).rssParser;
      parser.parseURL.mockResolvedValueOnce({
        items: [
          { title: 'Trump annonce des frappes en Iran', link: 'https://example.com/1', contentSnippet: 'Décision présidentielle' },
          { title: 'Météo à Paris', link: 'https://example.com/2', contentSnippet: 'Soleil' },
          { title: 'Le président réagit après les tirs', link: 'https://example.com/3', contentSnippet: 'Maison Blanche' },
        ],
      });

      const result = await (service as any).fetchSingleFeed(feed);
      expect(result).toHaveLength(2);
      expect(result[0].source).toBe('testmedia');
    });
  });

  describe('scoreNews — fallback heuristique', () => {
    it('scores breaking news high without AI', async () => {
      const items = [
        { url: 'https://example.com/a', title: 'Tirs contre Donald Trump', summary: 'Le président évacué', source: 'x', pubDate: new Date().toISOString() },
      ];
      const scored = await (service as any).scoreNews(items);
      expect(scored[0].criticality).toBeGreaterThanOrEqual(7);
      expect(scored[0].isBreaking).toBe(true);
      expect(scored[0].aiRelevance).toBe(0);
    });

    it('uses AI analysis when configured', async () => {
      process.env.TRUMP_AI_API_KEY = 'sk-test';
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify([
            { index: 0, relevance: 9, summary: 'Frappes en cours', reason: 'Événement majeur', breaking: true },
          ]) } }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const items = [
        { url: 'https://example.com/a', title: 'Trump ordonne des frappes', summary: 'Iran', source: 'x', pubDate: new Date().toISOString() },
      ];
      const scored = await (service as any).scoreNews(items);
      expect(scored[0].aiRelevance).toBe(9);
      expect(scored[0].isBreaking).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe('sortNews', () => {
    it('puts breaking items first, then by score, then by date', () => {
      const sorted = (service as any).sortNews([
        { url: '1', isBreaking: false, aiRelevance: 3, criticality: 3, pubDate: '2026-08-07T10:00:00Z' },
        { url: '2', isBreaking: true, aiRelevance: 5, criticality: 5, pubDate: '2026-08-07T08:00:00Z' },
        { url: '3', isBreaking: false, aiRelevance: 8, criticality: 8, pubDate: '2026-08-07T09:00:00Z' },
      ]);
      expect(sorted.map((s: any) => s.url)).toEqual(['2', '3', '1']);
    });
  });

  describe('getCachedTrumpNews', () => {
    it('returns cached items from DB sorted by relevance', async () => {
      const { prisma } = await import('../db/prisma.client');
      const fake = [
        { url: 'u1', title: 'A', source: 's', criticality: 4, aiRelevance: 0, isBreaking: false, pubDate: new Date('2026-08-07T10:00:00Z') },
        { url: 'u2', title: 'B', source: 's', criticality: 9, aiRelevance: 9, isBreaking: true, pubDate: new Date('2026-08-07T09:00:00Z') },
      ];
      (prisma.trumpNewsItem.findMany as any).mockResolvedValueOnce(fake);

      const result = await service.getCachedTrumpNews(10);
      expect(result.map((r: any) => r.url)).toEqual(['u2', 'u1']);
    });

    it('returns empty array on DB error', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.trumpNewsItem.findMany as any).mockRejectedValueOnce(new Error('db down'));
      const result = await service.getCachedTrumpNews(10);
      expect(result).toEqual([]);
    });
  });

  describe('getConfiguredFeeds', () => {
    it('defaults to the media feed list', () => {
      const feeds = getConfiguredFeeds();
      expect(feeds.length).toBeGreaterThanOrEqual(8);
      expect(feeds.some((f: any) => f.source === 'lemonde')).toBe(true);
    });

    it('parses override from env', () => {
      process.env.TRUMP_NEWS_FEEDS = 'https://example.com/feed|mymedia,https://other.com/rss';
      const feeds = getConfiguredFeeds();
      expect(feeds).toEqual([
        { url: 'https://example.com/feed', source: 'mymedia' },
        { url: 'https://other.com/rss', source: 'other.com' },
      ]);
      delete process.env.TRUMP_NEWS_FEEDS;
    });
  });

  describe('heuristique', () => {
    it('matches the shared scoring contract', () => {
      const { criticality } = scoreTrumpNewsHeuristically('Trump : guerre commerciale, nouveaux tarifs', '');
      expect(criticality).toBeGreaterThanOrEqual(1);
      const { criticality: c2 } = scoreTrumpNewsHeuristically('Recette de gâteau', '');
      expect(c2).toBe(0);
    });
  });
});

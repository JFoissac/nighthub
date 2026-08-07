import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketIntelService } from './market-intel.service';
import type { MarketService } from './market.service';
import type { TrumpService } from './trump.service';
import type { TrumpNewsService } from './trump-news.service';

function mockDeps(overrides: Partial<{
  market: MarketTicker[];
  posts: any[];
  news: any[];
  fng: any;
}> = {}) {
  const marketService = {
    getLiveMarketData: vi.fn().mockResolvedValue(overrides.market ?? [
      { symbol: 'VIX', price: 15.21, changePercent24h: -18.5 },
      { symbol: 'BTC', price: 60000, changePercent24h: 2.5 },
    ]),
  } as unknown as MarketService;

  const trumpService = {
    getCachedTrumpTweets: vi.fn().mockResolvedValue(overrides.posts ?? []),
  } as unknown as TrumpService;

  const trumpNewsService = {
    getCachedTrumpNews: vi.fn().mockResolvedValue(overrides.news ?? []),
  } as unknown as TrumpNewsService;

  // Mock global fetch for Fear&Greed
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [{ value: '29', value_classification: 'Fear', timestamp: '1754524800' }],
    }),
  }));

  return { marketService, trumpService, trumpNewsService };
}

type MarketTicker = {
  symbol: string;
  price?: number;
  changePercent24h?: number;
};

describe('MarketIntelService', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('getFearGreed retourne la valeur live et la met en cache', async () => {
    const deps = mockDeps();
    const svc = new MarketIntelService(deps.marketService, deps.trumpService, deps.trumpNewsService);

    const fg = await svc.getFearGreed();
    expect(fg.value).toBe(29);
    expect(fg.classification).toBe('Fear');
    expect(fg.source).toBe('live');

    // Cache : pas de second fetch
    await svc.getFearGreed();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('getFearGreed retombe sur le stale cache en cas de panne', async () => {
    const deps = mockDeps();
    const svc = new MarketIntelService(deps.marketService, deps.trumpService, deps.trumpNewsService);

    await svc.getFearGreed(); // remplit le cache
    // Périmer le cache (TTL 1h) pour forcer un refetch qui va échouer
    (svc as any).fngCache.fetchedAt = Date.now() - 2 * 60 * 60 * 1000;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const stale = await svc.getFearGreed();
    expect(stale.source).toBe('stale');
    expect(stale.value).toBe(29);
  });

  it('getMarketSentiment combine Fear&Greed + VIX + TCSD', async () => {
    const deps = mockDeps();
    const svc = new MarketIntelService(deps.marketService, deps.trumpService, deps.trumpNewsService);

    const s = await svc.getMarketSentiment();
    expect(s.fearGreed.value).toBe(29);
    expect(s.vix.value).toBe(15.21);
    expect(typeof s.score).toBe('number');
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(s.label).toBeTruthy();
  });

  it('TCSD détecte un post Trump bullish crypto (bitcoin)', async () => {
    const deps = mockDeps({
      posts: [{ content: 'We will make America the bitcoin superpower of the world. Great things ahead!' }],
    });
    const svc = new MarketIntelService(deps.marketService, deps.trumpService, deps.trumpNewsService);

    const s = await svc.getMarketSentiment();
    expect(s.tcsd.delta).toBeGreaterThan(0);
    expect(s.tcsd.signals.length).toBeGreaterThan(0);
    expect(s.tcsd.signals[0].sentiment).toBe('bullish');
  });

  it('TCSD ignore les posts non-crypto', async () => {
    const deps = mockDeps({
      posts: [{ content: 'Great rally tonight in Ohio. The crowd was incredible!' }],
    });
    const svc = new MarketIntelService(deps.marketService, deps.trumpService, deps.trumpNewsService);

    const s = await svc.getMarketSentiment();
    expect(s.tcsd.delta).toBe(0);
    expect(s.tcsd.source).toBe('none');
  });
});

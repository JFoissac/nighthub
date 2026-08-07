import { logger } from '../utils/logger';
import type { MarketService } from './market.service';
import type { TrumpService } from './trump.service';
import type { TrumpNewsService } from './trump-news.service';

/**
 * Market Intel — sentiment de marché composite.
 *
 * Combine trois signaux :
 *  1. Fear & Greed Index (Alternative.me, gratuit sans clé) — sentiment crypto 0-100
 *  2. VIX (volatilité / peur des marchés actions) — niveau + variation
 *  3. TCSD — Trump Communication Sentiment Delta : analyse des posts et news
 *     Trump récents avec des mots-clés crypto/marchés → delta -2..+2
 *
 * Score final : risque-on / risque-off avec composantes explicites.
 */

export type SentimentLabel = 'EXTREME PEUR' | 'PEUR' | 'NEUTRE' | 'AVIDITÉ' | 'EXTREME AVIDITÉ' | 'RISK-ON' | 'RISK-OFF';

export interface FearGreedData {
  value: number;
  classification: string;
  updatedAt: string;
  source: 'live' | 'stale' | 'error';
}

export interface TcsdData {
  delta: number; // -2 .. +2
  signals: { text: string; sentiment: 'bullish' | 'bearish' | 'neutral'; source: string }[];
  source: 'ai' | 'heuristic' | 'none';
}

export interface MarketSentiment {
  fearGreed: FearGreedData;
  vix: { value: number | null; changePercent24h: number | null };
  tcsd: TcsdData;
  score: number; // 0-100 (0 = peur extrême, 100 = avidité extrême)
  label: SentimentLabel;
  computedAt: string;
}

const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'crypto', 'ethereum', 'eth', 'sec', 'gensler',
  'coinbase', 'binance', 'xrp', 'stablecoin', 'mining', 'nft',
  'digital asset', 'fed', 'tariff', 'tariffs', 'inflation', 'rate cut',
];

const BULLISH_PATTERNS = ['adopt', 'buy', 'support', 'win', 'great', 'love', 'freedom', 'unleash', 'american', 'triumph'];
const BEARISH_PATTERNS = ['against', 'ban', 'fraud', 'crackdown', 'tax', 'war', 'attack', 'fear', 'crash', 'crisis', 'sanction'];

export class MarketIntelService {
  private fngCache: { data: FearGreedData; fetchedAt: number } | null = null;
  private static readonly FNG_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

  constructor(
    private readonly marketService: MarketService,
    private readonly trumpService: TrumpService,
    private readonly trumpNewsService: TrumpNewsService,
  ) {}

  /** Fear & Greed Index (Alternative.me) — cache 1h, stale-while-error. */
  async getFearGreed(): Promise<FearGreedData> {
    const now = Date.now();
    if (this.fngCache && now - this.fngCache.fetchedAt < MarketIntelService.FNG_CACHE_TTL_MS) {
      return this.fngCache.data;
    }
    try {
      const res = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`FNG ${res.status}`);
      const json: any = await res.json();
      const item = json?.data?.[0];
      if (!item) throw new Error('FNG empty payload');
      const data: FearGreedData = {
        value: parseInt(item.value, 10) || 50,
        classification: item.value_classification || 'Neutral',
        updatedAt: item.timestamp ? new Date(parseInt(item.timestamp, 10) * 1000).toISOString() : new Date().toISOString(),
        source: 'live',
      };
      this.fngCache = { data, fetchedAt: now };
      return data;
    } catch (e) {
      logger.warn('[MarketIntel] Fear&Greed fetch failed', { error: (e as Error).message });
      if (this.fngCache) return { ...this.fngCache.data, source: 'stale' };
      return { value: 50, classification: 'Neutral', updatedAt: new Date().toISOString(), source: 'error' };
    }
  }

  /** Snapshot VIX depuis les données marché existantes (jamais de fetch dédié). */
  private async getVixSnapshot(): Promise<{ value: number | null; changePercent24h: number | null }> {
    try {
      const market = await this.marketService.getLiveMarketData();
      const vix = market.find((t) => t.symbol === 'VIX' || t.symbol === '^VIX');
      if (!vix) return { value: null, changePercent24h: null };
      return { value: vix.price ?? null, changePercent24h: vix.changePercent24h ?? null };
    } catch (e) {
      logger.warn('[MarketIntel] VIX lookup failed', { error: (e as Error).message });
      return { value: null, changePercent24h: null };
    }
  }

  /** TCSD — Trump Communication Sentiment Delta sur la crypto/marchés. */
  private async getTcsd(): Promise<TcsdData> {
    const signals: TcsdData['signals'] = [];
    let delta = 0;

    const scoreText = (text: string, source: string): number => {
      const lower = text.toLowerCase();
      const hasCrypto = CRYPTO_KEYWORDS.some((k) => lower.includes(k));
      if (!hasCrypto) return 0;
      let d = 0;
      for (const p of BULLISH_PATTERNS) if (lower.includes(p)) d += 1;
      for (const p of BEARISH_PATTERNS) if (lower.includes(p)) d -= 1;
      const clamped = Math.max(-2, Math.min(2, d));
      if (clamped !== 0) {
        signals.push({
          text: text.slice(0, 140),
          sentiment: clamped > 0 ? 'bullish' : 'bearish',
          source,
        });
      }
      return clamped;
    };

    try {
      const [posts, news] = await Promise.allSettled([
        this.trumpService.getCachedTrumpTweets(20),
        this.trumpNewsService.getCachedTrumpNews(20),
      ]);

      if (posts.status === 'fulfilled' && Array.isArray(posts.value)) {
        for (const p of posts.value) {
          delta += scoreText(`${p.content || ''} ${p.title || ''}`, 'post');
        }
      }
      if (news.status === 'fulfilled' && Array.isArray(news.value)) {
        for (const n of news.value) {
          delta += scoreText(`${n.title || ''} ${n.summary || ''}`, 'news');
        }
      }
    } catch (e) {
      logger.warn('[MarketIntel] TCSD analysis failed', { error: (e as Error).message });
    }

    return {
      delta: Math.max(-2, Math.min(2, delta)),
      signals: signals.slice(0, 8),
      source: signals.length > 0 ? 'heuristic' : 'none',
    };
  }

  /** News marché/crypto via NewsAPI (NEWS_API_KEY), cache 10 min. */
  async getMarketNews(): Promise<any[]> {
    try {
      const key = process.env.NEWS_API_KEY;
      if (!key) return [];
      const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=12&apiKey=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json?.articles ?? []).map((a: any) => ({
        title: a.title || '',
        url: a.url || '',
        source: a.source?.name || 'news',
        publishedAt: a.publishedAt || null,
      }));
    } catch (e) {
      logger.warn('[MarketIntel] Market news failed', { error: (e as Error).message });
      return [];
    }
  }

  /** Sentiment de marché composite. */
  async getMarketSentiment(): Promise<MarketSentiment> {
    const [fearGreed, vix, tcsd] = await Promise.all([
      this.getFearGreed(),
      this.getVixSnapshot(),
      this.getTcsd(),
    ]);

    // Composante Fear&Greed : 0-100 → 0-70 (poids principal)
    let score = fearGreed.value * 0.7;

    // Composante VIX : <15 très risk-on, >30 très risk-off → -15..+15
    if (vix.value != null) {
      const vixScore = Math.max(-15, Math.min(15, (30 - vix.value) / 1.2));
      score += vixScore;
    }

    // Composante TCSD : delta -2..+2 → -15..+15
    score += tcsd.delta * 7.5;

    score = Math.max(0, Math.min(100, Math.round(score)));

    let label: SentimentLabel;
    if (score <= 20) label = 'EXTREME PEUR';
    else if (score <= 40) label = 'PEUR';
    else if (score <= 60) label = 'NEUTRE';
    else if (score <= 80) label = 'AVIDITÉ';
    else label = 'EXTREME AVIDITÉ';

    return {
      fearGreed,
      vix,
      tcsd,
      score,
      label,
      computedAt: new Date().toISOString(),
    };
  }
}

export function createMarketIntelService(
  marketService: MarketService,
  trumpService: TrumpService,
  trumpNewsService: TrumpNewsService,
): MarketIntelService {
  return new MarketIntelService(marketService, trumpService, trumpNewsService);
}

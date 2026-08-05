import { logger } from '../utils/logger';
import { TRACKED_STOCKS } from './market.catalog';

export interface MarketTicker {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  change7d: number;
  changePercent7d: number;
  volume: number;
  high24h: number;
  low24h: number;
  sparkline7d: number[];
  type: 'crypto' | 'stock';
  groupKey?: string;
  groupLabel?: string;
}

const BINANCE_SYMBOLS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', display: 'BTC' },
  { symbol: 'ETHUSDT', name: 'Ethereum', display: 'ETH' },
  { symbol: 'SOLUSDT', name: 'Solana', display: 'SOL' },
  { symbol: 'XRPUSDT', name: 'XRP', display: 'XRP' },
  { symbol: 'ADAUSDT', name: 'Cardano', display: 'ADA' },
];

function getCoinGeckoKey(): string {
  return process.env.COINGECKO_API_KEY || '';
}

const MARKET_CACHE_TTL_MS = 60_000;
const MARKET_FETCH_DEADLINE_MS = 15_000;
const TICKER_FETCH_TIMEOUT_MS = 5_000;
const TICKER_BATCH_SIZE = 5;

export class MarketService {
  private cache: { data: MarketTicker[]; fetchedAt: number } | null = null;
  private fetchInFlight: Promise<MarketTicker[]> | null = null;

  async getLiveMarketData(): Promise<MarketTicker[]> {
    // Fast path: fresh in-memory cache
    if (this.cache && Date.now() - this.cache.fetchedAt < MARKET_CACHE_TTL_MS) {
      return this.cache.data;
    }

    // Deduplicate concurrent fetches
    if (this.fetchInFlight) {
      return this.fetchInFlight;
    }

    this.fetchInFlight = this.fetchWithDeadline().finally(() => {
      this.fetchInFlight = null;
    });
    return this.fetchInFlight;
  }

  /**
   * Fetch with a hard global deadline. If the deadline wins, serve the stale
   * cache (if any) so the dashboard never blocks on an unreachable network.
   */
  private async fetchWithDeadline(): Promise<MarketTicker[]> {
    let settled = false;
    let fetched: MarketTicker[] = [];

    const fetchPromise = this.fetchAll().then((data) => {
      settled = true;
      fetched = data;
      if (data.length > 0) {
        this.cache = { data, fetchedAt: Date.now() };
      }
      return data;
    });

    const deadlinePromise = new Promise<MarketTicker[]>((resolve) => {
      setTimeout(() => resolve(settled ? fetched : (this.cache?.data ?? [])), MARKET_FETCH_DEADLINE_MS);
    });

    const result = await Promise.race([fetchPromise, deadlinePromise]);

    // All sources failed and we have stale data: keep showing it (stale-while-error)
    if (result.length === 0 && this.cache) {
      return this.cache.data;
    }
    return result;
  }

  private async fetchAll(): Promise<MarketTicker[]> {
    const results: MarketTicker[] = [];

    const [crypto, stocks] = await Promise.allSettled([
      this.fetchCrypto(),
      this.fetchStocks(),
    ]);

    if (crypto.status === 'fulfilled') {
      results.push(...crypto.value);
    } else {
      logger.error('[Market] Crypto fetch failed', crypto.reason);
    }

    if (stocks.status === 'fulfilled') {
      results.push(...stocks.value);
    } else {
      logger.error('[Market] Stocks fetch failed', stocks.reason);
    }

    return results;
  }

  private async fetchCrypto(): Promise<MarketTicker[]> {
    try {
      return await this.fetchBinanceCrypto();
    } catch (e) {
      logger.error('[Market] Binance failed, trying CoinGecko fallback', e);
      const cgKey = getCoinGeckoKey();
      if (cgKey) {
        return this.fetchCoinGecko(cgKey);
      }
      throw e;
    }
  }

  private async fetchBinanceCrypto(): Promise<MarketTicker[]> {
    const symbols = BINANCE_SYMBOLS.map(s => s.symbol);
    const tickerUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;

    const tickerRes = await fetch(tickerUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!tickerRes.ok) throw new Error(`Binance ticker ${tickerRes.status}`);
    const tickers: any[] = await tickerRes.json();
    const tickerMap = new Map(tickers.map(t => [t.symbol, t]));

    // Fetch 8-day klines for each symbol in parallel
    const klinePromises = BINANCE_SYMBOLS.map(async ({ symbol, name, display }) => {
      try {
        const klineUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=8`;
        const klineRes = await fetch(klineUrl, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(8000),
        });
        if (!klineRes.ok) return null;
        const klines: any[][] = await klineRes.json();
        if (!klines.length) return null;

        const closes = klines.map(k => parseFloat(k[4]));
        const t = tickerMap.get(symbol);
        if (!t) return null;

        const price = parseFloat(t.lastPrice);
        const openPrice = parseFloat(t.openPrice);
        const change24h = price - openPrice;
        const changePercent24h = openPrice ? (change24h / openPrice) * 100 : 0;

        const firstClose = closes[0];
        const lastClose = closes[closes.length - 1];
        const change7d = lastClose - firstClose;
        const changePercent7d = firstClose ? (change7d / firstClose) * 100 : 0;

        return {
          symbol: display,
          name,
          price,
          change24h,
          changePercent24h,
          change7d,
          changePercent7d,
          volume: parseFloat(t.volume) * price,
          high24h: parseFloat(t.highPrice),
          low24h: parseFloat(t.lowPrice),
          sparkline7d: closes,
          type: 'crypto' as const,
        };
      } catch (e) {
        logger.error(`[Market] Binance kline failed for ${symbol}`, e);
        return null;
      }
    });

    const results = (await Promise.all(klinePromises)).filter(Boolean) as MarketTicker[];
    if (results.length === 0) throw new Error('All Binance crypto fetches failed');
    return results;
  }

  private async fetchCoinGecko(apiKey: string): Promise<MarketTicker[]> {
    const ids = ['bitcoin', 'ethereum', 'solana', 'ripple', 'cardano'];
    const names: Record<string, string> = {
      bitcoin: 'Bitcoin', ethereum: 'Ethereum', solana: 'Solana',
      ripple: 'XRP', cardano: 'Cardano',
    };
    const symbols: Record<string, string> = {
      bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL',
      ripple: 'XRP', cardano: 'ADA',
    };

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(apiKey ? { 'x-cg-demo-api-key': apiKey } : {}),
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

    const data = await res.json();
    return ids
      .filter(id => data[id])
      .map(id => ({
        symbol: symbols[id],
        name: names[id],
        price: data[id].usd,
        change24h: 0,
        changePercent24h: data[id].usd_24h_change ?? 0,
        change7d: 0,
        changePercent7d: 0,
        volume: 0,
        high24h: 0,
        low24h: 0,
        sparkline7d: [],
        type: 'crypto' as const,
      }));
  }

  private async fetchStocks(): Promise<MarketTicker[]> {
    const deadlineAt = Date.now() + MARKET_FETCH_DEADLINE_MS;
    const results: (MarketTicker | null)[] = [];

    // Fetch in small parallel batches to avoid DNS/connection storms when the
    // network is blocked; stop early once the global deadline is reached.
    for (let i = 0; i < TRACKED_STOCKS.length; i += TICKER_BATCH_SIZE) {
      if (Date.now() >= deadlineAt) {
        logger.warn('[Market] Yahoo fetch deadline reached, returning partial results');
        break;
      }

      const batch = TRACKED_STOCKS.slice(i, i + TICKER_BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((item) => this.fetchYahooTicker(item)),
      );

      for (const r of batchResults) {
        results.push(r.status === 'fulfilled' ? r.value : null);
      }
    }

    const filteredResults = results.filter(Boolean) as MarketTicker[];

    // Only fall back to Alpha Vantage when we have nothing cached at all.
    if (filteredResults.length === 0 && !this.cache) {
      return this.fetchAlphaVantageStocks();
    }

    return filteredResults;
  }

  private async fetchYahooTicker(item: { symbol: string; display: string; name: string; groupKey?: string; groupLabel?: string }): Promise<MarketTicker | null> {
    try {
      const encoded = encodeURIComponent(item.symbol);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=10d`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(TICKER_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) return null;
      const json = await response.json();
      const result = json?.chart?.result?.[0];
      if (!result?.meta || !result?.timestamp) return null;

      const meta = result.meta;
      const timestamps: number[] = result.timestamp;
      const closes: number[] = result.indicators?.quote?.[0]?.close || [];

      const validData = timestamps
        .map((t: number, i: number) => ({ time: t, close: closes[i] }))
        .filter((d: any) => d.close != null)
        .slice(-8);

      if (validData.length < 2) return null;

      const sparkline = validData.map((d: any) => d.close);
      const price = meta.regularMarketPrice || sparkline[sparkline.length - 1];
      const prevClose = meta.previousClose || meta.chartPreviousClose || sparkline[sparkline.length - 2];

      const change24h = price && prevClose ? price - prevClose : 0;
      const changePercent24h = price && prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

      const firstClose = sparkline[0];
      const lastClose = sparkline[sparkline.length - 1];
      const change7d = lastClose - firstClose;
      const changePercent7d = firstClose ? (change7d / firstClose) * 100 : 0;

      return {
        symbol: item.display,
        name: item.name,
        price,
        change24h,
        changePercent24h,
        change7d,
        changePercent7d,
        volume: meta.regularMarketVolume || 0,
        high24h: meta.regularMarketDayHigh || price,
        low24h: meta.regularMarketDayLow || price,
        sparkline7d: sparkline,
        type: 'stock' as const,
        groupKey: item.groupKey,
        groupLabel: item.groupLabel,
      };
    } catch (e) {
      logger.error(`[Market] Yahoo fetch failed for ${item.symbol}`, e);
      return null;
    }
  }

  private async fetchAlphaVantageStocks(): Promise<MarketTicker[]> {
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
    if (!apiKey) return [];

    const symbols = ['SPY', 'QQQ'];
    const results: MarketTicker[] = [];

    for (const sym of symbols) {
      try {
        const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) continue;
        const data = await res.json();
        const q = data['Global Quote'];
        if (!q) continue;

        const price = parseFloat(q['05. price']);
        const changePercent24h = parseFloat(q['10. change percent']?.replace('%', '') || '0');
        const change24h = parseFloat(q['09. change'] || '0');

        results.push({
          symbol: sym,
          name: sym === 'SPY' ? 'SPDR S&P 500' : 'Invesco QQQ',
          price,
          change24h,
          changePercent24h,
          change7d: 0,
          changePercent7d: 0,
          volume: parseInt(q['06. volume'] || '0'),
          high24h: 0,
          low24h: 0,
          sparkline7d: [],
          type: 'stock',
        });
      } catch (e) {
        logger.error(`[Market] Alpha Vantage failed for ${sym}`, e);
      }
    }

    return results;
  }
}

export function createMarketService(): MarketService {
  return new MarketService();
}

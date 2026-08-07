import Parser from 'rss-parser';
import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';
import {
  analyzeTrumpPostsWithAi,
  isTrumpAiEnabled,
  scoreTrumpNewsHeuristically,
  NEWS_CONTEXT_KEYWORDS,
} from './trump.ai';

/**
 * Veille « Trump à la TV / news / conférences de presse ».
 *
 * Scanne des flux RSS de médias (Reuters, AP, France Info, BFM, Le Monde,
 * Le Figaro, NYT, Guardian, BBC, CNN), filtre les dépêches parlant de Trump
 * (nom ou contexte politique US + mots-clés événement), les score (IA
 * OpenAI-compatible si configurée, sinon heuristique locale) et les cache en
 * base (table TrumpNewsItem).
 *
 * Config : TRUMP_NEWS_FEEDS (surcharge "url|label,url|label"),
 * TRUMP_NEWS_REFRESH_MINUTES (défaut 10).
 */

export interface TrumpNewsSource {
  url: string;
  source: string;
}

export const DEFAULT_TRUMP_NEWS_FEEDS: TrumpNewsSource[] = [
  { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'reuters' },
  { url: 'https://apnews.com/rss', source: 'ap' },
  { url: 'https://www.francetvinfo.fr/monde.rss', source: 'francetvinfo' },
  { url: 'https://www.bfmtv.com/rss/monde/', source: 'bfmtv' },
  { url: 'https://www.lemonde.fr/rss/une.xml', source: 'lemonde' },
  { url: 'https://www.lefigaro.fr/rss/figaro_actualite.xml', source: 'lefigaro' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'nytimes' },
  { url: 'https://www.theguardian.com/world/us-news/rss', source: 'guardian' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', source: 'bbc' },
  { url: 'http://rss.cnn.com/rss/edition_world.rss', source: 'cnn' },
];

/** Le nom de Trump doit apparaître, OU un événement grave co-occurrent avec le contexte politique US. */
const TRUMP_NAME_RE = /\btrump\b|mar-a-lago|maga/i;

const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
let lastRefreshedAt = 0;

function getRefreshIntervalMs(): number {
  const minutes = Number(process.env.TRUMP_NEWS_REFRESH_MINUTES);
  return Number.isFinite(minutes) && minutes > 0
    ? minutes * 60 * 1000
    : MIN_REFRESH_INTERVAL_MS;
}

export function getConfiguredFeeds(): TrumpNewsSource[] {
  const raw = process.env.TRUMP_NEWS_FEEDS;
  if (!raw) return DEFAULT_TRUMP_NEWS_FEEDS;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, label] = entry.split('|').map((part) => part.trim());
      if (!url || !url.startsWith('http')) return null;
      const fallbackLabel = (() => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return url;
        }
      })();
      return { url, source: label || fallbackLabel };
    })
    .filter((feed): feed is TrumpNewsSource => feed !== null);
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.pathname = u.pathname.replace(/\/+$/, '');
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid']
      .forEach((p) => u.searchParams.delete(p));
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}

function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500);
}

/**
 * Filtre une dépêche : doit parler de Trump (nom) ou associer un événement
 * grave (tirs, frappe, guerre...) à un contexte politique US.
 */
export function isTrumpNewsRelevant(title: string, summary: string): boolean {
  const text = `${title} ${summary}`;
  if (TRUMP_NAME_RE.test(text)) return true;
  const lower = text.toLowerCase();
  const { matchedKeywords } = scoreTrumpNewsHeuristically(title, summary);
  if (matchedKeywords.length === 0) return false;
  return NEWS_CONTEXT_KEYWORDS.some((kw) => lower.includes(kw));
}

export class TrumpNewsService {
  private rssParser = new Parser({
    timeout: 10_000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  async fetchTrumpNews(limit: number = 20): Promise<any[]> {
    if (!this.shouldRefresh()) {
      logger.info('[TrumpNews] Skipping refresh — data is recent (< 10 min)');
      return this.getCachedTrumpNews(limit);
    }

    const feeds = getConfiguredFeeds();
    const results = await Promise.allSettled(
      feeds.map((feed) => this.fetchSingleFeed(feed)),
    );

    const all: any[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }

    logger.info('[TrumpNews] Fetch done', { feeds: feeds.length, items: all.length });

    if (all.length > 0) {
      await this.cacheTrumpNews(all);
      lastRefreshedAt = Date.now();
    }

    return this.sortNews(all).slice(0, limit);
  }

  private shouldRefresh(): boolean {
    return Date.now() - lastRefreshedAt >= getRefreshIntervalMs();
  }

  private async fetchSingleFeed(feed: TrumpNewsSource): Promise<any[]> {
    try {
      const parsed = await this.rssParser.parseURL(feed.url);
      const items = parsed.items || [];
      const seen = new Map<string, any>();

      for (const item of items) {
        const url = normalizeUrl(item.link || item.guid || '');
        if (url && !seen.has(url)) seen.set(url, item);
      }

      const candidates = Array.from(seen.values())
        .slice(0, 30)
        .map((item: any) => ({
          title: clean(item.title || '').substring(0, 255),
          source: feed.source,
          url: normalizeUrl(item.link || item.guid || ''),
          summary: clean(item.contentSnippet || item.description || ''),
          pubDate: this.normalizeDate(item.pubDate || item.isoDate) || new Date().toISOString(),
        }))
        .filter((c) => c.title.length > 0 && c.url.length > 0);

      const relevant = candidates.filter((c) => isTrumpNewsRelevant(c.title, c.summary));
      logger.info('[TrumpNews] Feed filtered', {
        source: feed.source,
        total: candidates.length,
        relevant: relevant.length,
      });
      return relevant;
    } catch (e) {
      logger.error(`[TrumpNews] Feed error (${feed.source})`, e);
      return [];
    }
  }

  /** Score les dépêches : IA si configurée, sinon heuristique locale. */
  private async scoreNews(items: any[]): Promise<any[]> {
    if (isTrumpAiEnabled() && items.length > 0) {
      try {
        const analyses = await analyzeTrumpPostsWithAi(
          items.map((item) => ({ tweetId: item.url, content: `${item.title}. ${item.summary}` })),
        );
        if (analyses) {
          return items.map((item) => {
            const a = analyses.get(item.url);
            const heuristic = scoreTrumpNewsHeuristically(item.title, item.summary);
            if (!a) return this.withHeuristic(item, heuristic);
            return {
              ...item,
              aiRelevance: a.relevance,
              aiSummary: a.summary,
              aiReason: a.reason,
              // La criticalité garde l'échelle existante : max(heuristique, IA).
              criticality: Math.max(0, Math.min(10, Math.max(heuristic.criticality, a.relevance))),
              isBreaking: a.breaking || heuristic.breaking || heuristic.criticality >= 7,
              matchedKeywords: heuristic.matchedKeywords.join(','),
            };
          });
        }
      } catch (e) {
        logger.warn('[TrumpNews] AI scoring failed, using heuristic fallback', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return items.map((item) => this.withHeuristic(item, scoreTrumpNewsHeuristically(item.title, item.summary)));
  }

  private withHeuristic(item: any, heuristic: ReturnType<typeof scoreTrumpNewsHeuristically>): any {
    return {
      ...item,
      criticality: heuristic.criticality,
      aiRelevance: 0,
      aiSummary: '',
      aiReason: '',
      isBreaking: heuristic.breaking,
      matchedKeywords: heuristic.matchedKeywords.join(','),
    };
  }

  private sortNews(items: any[]): any[] {
    return [...items].sort((a, b) => {
      if (Boolean(a.isBreaking) !== Boolean(b.isBreaking)) return a.isBreaking ? -1 : 1;
      const aScore = a.aiRelevance || a.criticality || 0;
      const bScore = b.aiRelevance || b.criticality || 0;
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });
  }

  async getCachedTrumpNews(limit: number = 20): Promise<any[]> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const items = await prisma.trumpNewsItem.findMany({
        where: { pubDate: { gte: cutoff } },
        take: Math.min(limit * 2, 100),
        orderBy: [{ isBreaking: 'desc' }, { pubDate: 'desc' }],
      });
      return this.sortNews(items).slice(0, limit);
    } catch (e) {
      logger.error('Get cached trump news error', e);
      return [];
    }
  }

  private async cacheTrumpNews(items: any[]): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await prisma.trumpNewsItem.deleteMany({ where: { pubDate: { lt: cutoff } } });
    } catch (e) {
      logger.error('Purge old trump news error', e);
    }

    const scored = await this.scoreNews(items);

    for (const item of scored) {
      try {
        if (!item.url || !item.title) continue;
        const data = {
          title: item.title.substring(0, 255),
          source: item.source,
          url: item.url,
          summary: item.summary.substring(0, 500),
          pubDate: new Date(item.pubDate || new Date()),
          criticality: item.criticality || 0,
          aiRelevance: item.aiRelevance || 0,
          aiSummary: (item.aiSummary || '').substring(0, 200),
          aiReason: (item.aiReason || '').substring(0, 120),
          isBreaking: Boolean(item.isBreaking),
          matchedKeywords: (item.matchedKeywords || '').substring(0, 200),
        };
        await prisma.trumpNewsItem.upsert({
          where: { url: item.url },
          update: data,
          create: data,
        });
      } catch (e) {
        logger.error('Cache trump news item error', e);
      }
    }
  }

  private normalizeDate(date?: string): string | null {
    if (!date) return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
}

export function createTrumpNewsService(): TrumpNewsService {
  return new TrumpNewsService();
}

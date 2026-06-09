import Parser from 'rss-parser';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';
import { TIMEOUTS } from '../config/constants';

const rssParser = new Parser({
  timeout: TIMEOUTS.RSS_PARSER,
  headers: { 'User-Agent': 'NightHub/1.0 RSS Reader' },
});

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

export const ARTICLE_EXTRACTION_FAILED = 'ARTICLE_EXTRACTION_FAILED';
export const ARTICLE_URL_NOT_ALLOWED = 'ARTICLE_URL_NOT_ALLOWED';

export interface ExtractedArticleDto {
  title: string;
  source: string;
  content: string;
  contentHtml?: string;
  url: string;
}

const DEFAULT_RSS_FEEDS = [
  { url: 'https://next.ink/feed/free', source: 'next.ink' },
  { url: 'https://www.numerama.com/feed/', source: 'numerama' },
  { url: 'https://www.frandroid.com/feed/', source: 'frandroid' },
  { url: 'https://www.blogdumoderateur.com/dossier/openai/feed/', source: 'blogdumoderateur-openai' },
  { url: 'https://www.blogdumoderateur.com/dossier/anthropic/feed/', source: 'blogdumoderateur-anthropic' },
] as const;

export class NewsService {
  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
      u.pathname = u.pathname.replace(/\/+$/, '');
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid'];
      trackingParams.forEach(p => u.searchParams.delete(p));
      u.searchParams.sort();
      return u.toString();
    } catch {
      return url;
    }
  }

  async fetchAiNews(): Promise<any[]> {
    const [openai, anthropic, kimi, rss] = await Promise.allSettled([
      this.fetchOpenAI(),
      this.scrapeAnthropic(),
      this.scrapeKimi(),
      this.fetchConfiguredRssFeeds(),
    ]);

    const all = [
      ...(openai.status === 'fulfilled' ? openai.value : []),
      ...(anthropic.status === 'fulfilled' ? anthropic.value : []),
      ...(kimi.status === 'fulfilled' ? kimi.value : []),
      ...(rss.status === 'fulfilled' ? rss.value : []),
    ];

    if (all.length > 0) await this.cacheNews(all);

    return all.sort((a, b) =>
      this.toTimestamp(b.pubDate) - this.toTimestamp(a.pubDate)
    );
  }

  private async fetchConfiguredRssFeeds(): Promise<any[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      const raw = (pref as any)?.customRssFeeds || '';
      const customUrls = raw
        .split(/[\n,]/)
        .map((u: string) => u.trim())
        .filter((u: string) => u.startsWith('http'));

      const feeds = [
        ...DEFAULT_RSS_FEEDS,
        ...customUrls.map((url: string) => ({ url, source: new URL(url).hostname.replace('www.', '') })),
      ].filter((feed, index, allFeeds) =>
        allFeeds.findIndex((candidate) => candidate.url === feed.url) === index
      );

      const results = await Promise.allSettled(
        feeds.map(({ url, source }) => this.fetchSingleRss(url, source))
      );
      const all: any[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') all.push(...r.value);
      }
      return all;
    } catch (e) {
      logger.error('Custom RSS fetch error', e);
      return [];
    }
  }

  private async fetchSingleRss(url: string, source?: string): Promise<any[]> {
    const feed = await rssParser.parseURL(url);
    const domain = source || new URL(url).hostname.replace('www.', '');
    const items = feed.items || [];
    const seenUrls = new Map<string, any>();

    for (const item of items) {
      const normalizedUrl = this.normalizeUrl(item.link || url);
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.set(normalizedUrl, item);
      }
    }

    const uniqueItems = Array.from(seenUrls.values());
    logger.info('[News] Custom RSS fetch', { domain, totalItems: items.length, uniqueItems: uniqueItems.length });
    uniqueItems.slice(0, 2).forEach((item: any, i: number) => {
      logger.debug('[News] Custom RSS item', {
        domain,
        index: i,
        title: item.title?.substring(0, 50),
        pubDate: item.pubDate,
        isoDate: item.isoDate,
      });
    });
    return uniqueItems.slice(0, 8).map((item: any) => {
      const pubDate = this.normalizeDate(item.pubDate || item.isoDate);
      const categories = (item.categories || []).join(',').substring(0, 200);
      const author = (item.creator || item.author || item['dc:creator'] || '').substring(0, 100);
      return {
        title: (item.title || '').substring(0, 255),
        source: domain,
        url: item.link || url,
        summary: this.clean(item.contentSnippet || item.description || ''),
        isNew: pubDate ? this.isRecent(pubDate) : false,
        pubDate: pubDate || new Date().toISOString(),
        categories,
        author,
      };
    });
  }

  private async fetchOpenAI(): Promise<any[]> {
    const feed = await rssParser.parseURL('https://openai.com/news/rss.xml');
    const items = feed.items || [];
    const seenUrls = new Map<string, any>();

    for (const item of items) {
      const normalizedUrl = this.normalizeUrl(item.link || 'https://openai.com/news');
      if (!seenUrls.has(normalizedUrl)) {
        seenUrls.set(normalizedUrl, item);
      }
    }

    const uniqueItems = Array.from(seenUrls.values());
    logger.info('[News] OpenAI RSS fetch', { totalItems: items.length, uniqueItems: uniqueItems.length });
    uniqueItems.slice(0, 3).forEach((item: any, i: number) => {
      logger.debug('[News] OpenAI item', {
        index: i,
        title: item.title?.substring(0, 50),
        pubDate: item.pubDate,
        isoDate: item.isoDate,
      });
    });
    return uniqueItems.slice(0, 10).map((item: any) => {
      const pubDate = this.normalizeDate(item.pubDate || item.isoDate);
      return {
        title: item.title || 'OpenAI News',
        source: 'openai',
        url: item.link || 'https://openai.com/news',
        summary: this.clean(item.contentSnippet || item.description || ''),
        isNew: pubDate ? this.isRecent(pubDate) : false,
        pubDate: pubDate || new Date().toISOString(),
      };
    });
  }

  private async scrapeAnthropic(): Promise<any[]> {
    logger.info('[News] Fetching Anthropic news...');
    const res = await fetch('https://www.anthropic.com/news', { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const html = await res.text();

    const articles: any[] = [];
    const seen = new Set<string>();

    const regex = /href="(\/news\/([a-z0-9][a-z0-9-]{3,60}))"/g;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(html)) !== null) {
      const [, path, slug] = m;
      if (seen.has(slug)) continue;
      seen.add(slug);

      const after = html.slice(m.index, m.index + 1200);
      const titleMatch =
        after.match(/class="[^"]*title[^"]*"[^>]*>([^<]{10,150})</) ||
        after.match(/<h[23][^>]*>([^<]{10,150})<\/h[23]>/) ||
        after.match(/>[A-Z][^<]{10,120}</);

      const before = html.slice(Math.max(0, m.index - 300), m.index);
      const beforeH = before.match(/<h[23][^>]*>([^<]{10,150})<\/h[23]>(?!.*<h[23])/s);

      let title = (titleMatch?.[1] || beforeH?.[1] || '')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (!title || title.length < 8) {
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      if (title.length > 5) {
        articles.push({
          title,
          source: 'anthropic',
          url: `https://www.anthropic.com${path}`,
          summary: `Article Anthropic: ${title}`,
        });
      }
    }

    logger.info('[News] Anthropic found article paths', { count: articles.length });

    const articlesWithDates = await Promise.allSettled(
      articles.slice(0, 10).map(async (article) => {
        try {
          const pageRes = await fetch(article.url, { headers: FETCH_HEADERS });
          if (!pageRes.ok) return { ...article, pubDate: new Date().toISOString(), isNew: false };
          const pageHtml = await pageRes.text();

          let pubDate: string | null = null;

          const dateMetaMatch = pageHtml.match(/<meta[^>]+property="[^"]*published[^"]*"[^>]+content="([^"]+)"/i) ||
            pageHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="[^"]*published[^"]*"/i) ||
            pageHtml.match(/<time[^>]+datetime="([^"]+)"/i) ||
            pageHtml.match(/<time[^>]+>([^<]+)<\/time>/i);

          if (dateMetaMatch) {
            pubDate = this.normalizeDate(dateMetaMatch[1]);
          }

          if (!pubDate) {
            const ogDateMatch = pageHtml.match(/<meta[^>]+property="og:published_time"[^>]+content="([^"]+)"/i) ||
              pageHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:published_time"/i);
            if (ogDateMatch) {
              pubDate = this.normalizeDate(ogDateMatch[1]);
            }
          }

          if (!pubDate) {
            const schemaMatch = pageHtml.match(/"datePublished"\s*:\s*"([^"]+)"/i);
            if (schemaMatch) {
              pubDate = this.normalizeDate(schemaMatch[1]);
            }
          }

          if (!pubDate) {
            const textDateMatch = pageHtml.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/);
            if (textDateMatch) {
              pubDate = this.normalizeDate(textDateMatch[0]);
            }
          }

          pubDate = pubDate || new Date().toISOString();

          return {
            ...article,
            pubDate,
            isNew: this.isRecent(pubDate),
          };
        } catch {
          return { ...article, pubDate: new Date().toISOString(), isNew: false };
        }
      })
    );

    const result = articlesWithDates
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map(r => r.value);

    logger.info('[News] Anthropic scraped', { articleCount: result.length });
    result.slice(0, 3).forEach((a, i) => {
      logger.debug('[News] Anthropic article', {
        index: i,
        title: a.title?.substring(0, 50),
        pubDate: a.pubDate,
      });
    });
    return result;
  }

  private async scrapeKimi(): Promise<any[]> {
    const res = await fetch('https://www.kimi.com/blog/', { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`Kimi HTTP ${res.status}`);
    const html = await res.text();

    const articles: any[] = [];
    const seen = new Set<string>();

    const linkRegex = /<a[^>]+href="(\/blog\/([^"/?#]{3,80}))"[^>]*>/g;
    let linkMatch: RegExpExecArray | null;

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const [, path, slug] = linkMatch;
      if (slug === '' || seen.has(slug)) continue;

      const anchorEnd = html.indexOf('</a>', linkMatch.index);
      const surroundingEnd = anchorEnd === -1
        ? linkMatch.index + 600
        : anchorEnd + 4;
      const surrounding = html.slice(linkMatch.index, surroundingEnd);
      const textContent = surrounding.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      const dateMatch = textContent.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);

      if (!dateMatch) continue;
      seen.add(slug);

      const titleMatch =
        surrounding.match(/<h[123][^>]*>([^<]{5,120})<\/h[123]>/i) ||
        surrounding.match(/class="[^"]*title[^"]*"[^>]*>([^<]{5,120})</i) ||
        surrounding.match(/>([A-Z][a-zA-Z0-9\s:,. \-]{5,100})</);

      let title = (titleMatch?.[1] || '').trim();
      if (!title || title.length < 5) {
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      const pubDate = this.normalizeDate(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) || new Date().toISOString();

      articles.push({
        title,
        source: 'kimi',
        url: `https://www.kimi.com${path}`,
        summary: `Blog Kimi: ${title}`,
        pubDate,
        isNew: this.isRecent(pubDate),
      });
    }

    logger.info('[News] Kimi scraped from index', { count: articles.length });

    if (articles.length === 0) {
      logger.warn('[News] Kimi: No articles found on index page, trying fallback...');
      const knownArticles = [
        { slug: 'kimi-k2-6', title: 'Kimi K2.6', date: '2026-04-20' },
        { slug: 'agent-swarm', title: 'Agent Swarm', date: '2026-02-09' },
        { slug: 'worldvqa', title: 'WorldVQA', date: '2026-02-03' },
        { slug: 'kimi-k2-5', title: 'Kimi K2.5', date: '2026-01-27' },
        { slug: 'kimi-k2-thinking', title: 'Kimi K2 Thinking', date: '2025-11-06' },
        { slug: 'kimi-k2', title: 'Kimi K2', date: '2025-07-11' },
      ];
      return knownArticles.map(a => ({
        title: a.title,
        source: 'kimi',
        url: `https://www.kimi.com/blog/${a.slug}`,
        summary: `Blog Kimi: ${a.title}`,
        isNew: this.isRecent(a.date),
        pubDate: new Date(a.date).toISOString(),
      }));
    }

    logger.info('[News] Kimi scraped', { count: articles.length });
    articles.slice(0, 3).forEach((a, i) => {
      logger.debug('[News] Kimi article', {
        index: i,
        title: a.title?.substring(0, 50),
        pubDate: a.pubDate,
      });
    });
    return articles.slice(0, 10);
  }

  private clean(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim()
      .substring(0, 500);
  }

  private normalizeDate(date?: string): string | null {
    if (!date) return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private toTimestamp(date?: string): number {
    return this.normalizeDate(date) ? new Date(date as string).getTime() : 0;
  }

  private isRecent(date?: string): boolean {
    if (!date) return false;
    const diffH = (Date.now() - new Date(date).getTime()) / 3600000;
    return diffH < 24;
  }

private async cacheNews(items: any[]): Promise<void> {
    for (const item of items) {
      try {
        if (!item.url || !item.title) continue;
        const normalizedUrl = this.normalizeUrl(item.url);
        const exists = await prisma.aiNewsItem.findFirst({ where: { url: normalizedUrl } });
        if (!exists) {
          await prisma.aiNewsItem.create({
            data: {
              title: item.title.substring(0, 255),
              source: item.source,
              url: normalizedUrl,
              summary: (item.summary || '').substring(0, 500),
              pubDate: new Date(item.pubDate || new Date()),
              isNew: item.isNew ?? false,
              categories: (item.categories || '').substring(0, 200),
              author: (item.author || '').substring(0, 100),
            },
          });
        } else {
          await prisma.aiNewsItem.update({
            where: { id: exists.id },
            data: {
              title: item.title.substring(0, 255),
              source: item.source,
              summary: (item.summary || '').substring(0, 500),
              pubDate: new Date(item.pubDate || new Date()),
              isNew: item.isNew ?? false,
              categories: (item.categories || '').substring(0, 200),
              author: (item.author || '').substring(0, 100),
              fetchedAt: new Date(),
            },
          });
        }
      } catch (e) {
        logger.error('Cache news item error', e);
      }
    }
  }

  async getCachedNews(limit = 20): Promise<any[]> {
    try {
      return await prisma.aiNewsItem.findMany({
        take: limit,
        orderBy: { pubDate: 'desc' },
      });
    } catch {
      return [];
    }
  }

  async validateFeedUrl(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(5000) });
      if (!res.ok) return false;
      const text = await res.text();
      const first2000 = text.slice(0, 2000);
      return first2000.includes('<rss') || first2000.includes('<feed') || first2000.includes('<channel');
    } catch {
      return false;
    }
  }

  async detectFeed(siteUrl: string): Promise<string | null> {
    try {
      const res = await fetch(siteUrl, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const html = await res.text();
        const match = html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i)
          || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i);
        if (match) {
          const href = match[1];
          const resolved = href.startsWith('http') ? href : new URL(href, siteUrl).toString();
          if (await this.validateFeedUrl(resolved)) return resolved;
        }
      }
    } catch {
    }

    const origin = new URL(siteUrl).origin;
    const candidates = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/feed/rss', '/blog/feed'];
    for (const path of candidates) {
      const candidate = `${origin}${path}`;
      if (await this.validateFeedUrl(candidate)) return candidate;
    }

    return null;
  }

  async extractArticleText(url: string): Promise<ExtractedArticleDto> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(ARTICLE_URL_NOT_ALLOWED);
    }

    if (!(await this.isAllowedExtractionUrl(parsedUrl))) {
      throw new Error(ARTICLE_URL_NOT_ALLOWED);
    }

    try {
      const res = await fetch(parsedUrl.toString(), {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (res.status >= 300 && res.status < 400) {
        throw new Error(ARTICLE_URL_NOT_ALLOWED);
      }
      if (res.status >= 400) {
        throw new Error(`HTTP_${res.status}`);
      }

      const html = await res.text();
      const title = this.extractArticleTitle(html);
      const cleaned = this.removeNoiseNodes(html);
      const container = this.pickReadableContainer(cleaned);
      const { text, html: contentHtml } = this.normalizeContentBlocks(container);

      if (!text || this.isLikelyPaywall(text)) {
        throw new Error('UNREADABLE_CONTENT');
      }

      return {
        title,
        source: parsedUrl.hostname.replace(/^www\./, '').toLowerCase(),
        content: text,
        contentHtml,
        url: parsedUrl.toString(),
      };
    } catch (error) {
      if ((error as Error)?.message === ARTICLE_URL_NOT_ALLOWED) {
        throw error;
      }
      const code = (error as Error)?.name === 'AbortError'
        ? 'TIMEOUT'
        : (error as Error)?.message || 'UNKNOWN';
      logger.warn('[News] extractArticleText failed', { code, url: parsedUrl.toString() });
      throw new Error(ARTICLE_EXTRACTION_FAILED);
    }
  }

  private async isAllowedExtractionUrl(url: URL): Promise<boolean> {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    if (this.isHostnameBlocked(hostname)) {
      return false;
    }

    const hostForIpChecks = this.normalizeHostForIpChecks(hostname);
    const ipKind = isIP(hostForIpChecks);
    if (ipKind > 0 && this.isPrivateOrInternalIp(hostForIpChecks)) {
      return false;
    }

    if (ipKind > 0) return true;
    const failClosedOnDnsError = this.isSuspiciousIpLikeHost(hostForIpChecks);

    try {
      const records = await lookup(hostname, { all: true, verbatim: true });
      return records.every((record) => !this.isPrivateOrInternalIp(record.address));
    } catch {
      return !failClosedOnDnsError;
    }
  }

  private isHostnameBlocked(hostname: string): boolean {
    if (hostname === 'localhost') return true;
    if (hostname.endsWith('.localhost')) return true;
    if (hostname.endsWith('.local')) return true;
    if (hostname.endsWith('.internal')) return true;
    return false;
  }

  private isPrivateOrInternalIp(ip: string): boolean {
    const kind = isIP(ip);
    if (kind === 4) return this.isPrivateOrInternalIpv4(ip);
    if (kind === 6) return this.isPrivateOrInternalIpv6(ip);
    return false;
  }

  private isPrivateOrInternalIpv4(ip: string): boolean {
    const octets = ip.split('.').map((part) => Number(part));
    if (octets.length !== 4 || octets.some((n) => Number.isNaN(n))) return false;
    const [a, b] = octets;

    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }

  private isPrivateOrInternalIpv6(ip: string): boolean {
    const normalized = this.normalizeHostForIpChecks(ip).toLowerCase();
    const mappedIpv4 = this.extractMappedIpv4FromIpv6(normalized);
    if (mappedIpv4) return this.isPrivateOrInternalIpv4(mappedIpv4);
    if (normalized === '::1') return true;
    if (normalized === '::') return true;
    if (/^fe[89ab][0-9a-f]*:/.test(normalized)) return true; // link-local fe80::/10
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique-local
    return false;
  }

  private normalizeHostForIpChecks(hostname: string): string {
    const unbracketed = hostname.replace(/^\[/, '').replace(/\]$/, '');
    const zoneIndex = unbracketed.indexOf('%');
    if (zoneIndex >= 0) return unbracketed.slice(0, zoneIndex);
    return unbracketed;
  }

  private isSuspiciousIpLikeHost(hostname: string): boolean {
    if (hostname.includes(':')) return true;
    if (/^[\d.]+$/.test(hostname)) return true;
    return false;
  }

  private extractMappedIpv4FromIpv6(ipv6: string): string | null {
    const dottedMatch = ipv6.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (dottedMatch) return dottedMatch[1];

    const hexMatch = ipv6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (!hexMatch) return null;

    const hi = parseInt(hexMatch[1], 16);
    const lo = parseInt(hexMatch[2], 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return null;

    const octets = [
      (hi >> 8) & 0xff,
      hi & 0xff,
      (lo >> 8) & 0xff,
      lo & 0xff,
    ];
    return octets.join('.');
  }

  private removeNoiseNodes(html: string): string {
    let out = html;
    const stripTagWithContent = [
      'script', 'style', 'nav', 'aside', 'img', 'svg', 'canvas',
      'video', 'audio', 'figure', 'picture', 'noscript', 'iframe',
      'form', 'button', 'ul', 'ol', 'dl', 'table', 'thead', 'tbody',
      'tfoot', 'tr', 'blockquote', 'pre', 'code',
    ];
    for (const tag of stripTagWithContent) {
      const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
      out = out.replace(re, ' ');
      const selfClosingRe = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
      out = out.replace(selfClosingRe, ' ');
    }

    out = out.replace(
      /<(div|section|span)[^>]*(class|id)=["'][^"']*(cookie|banner|subscribe|newsletter|promo|advert|social|share|related|recommend|tags|categories|sidebar|footer|header|nav|menu|breadcrumb|author|date|time)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      ' '
    );

    return out;
  }

  private pickReadableContainer(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch?.[1] || html;

    const containerRegexes = [
      /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
      /<main\b[^>]*>([\s\S]*?)<\/main>/gi,
      /<(section|div)\b[^>]*(id|class)=["'][^"']*(content|article|post|entry|story|main|body)[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi,
    ];

    const candidates: string[] = [];
    for (const re of containerRegexes) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const extracted = m[4] || m[1] || '';
        if (extracted.trim()) candidates.push(extracted);
      }
    }
    candidates.push(body);

    let best = body;
    let bestScore = 0;
    for (const candidate of candidates) {
      const plain = this.htmlToPlain(candidate);
      const paragraphCount = (candidate.match(/<(p|h2|h3|li)\b/gi) || []).length;
      const score = plain.length + paragraphCount * 180;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return best;
  }

  private normalizeContentBlocks(containerHtml: string): { text: string; html: string } {
    const blocks: { tag: string; text: string; html: string }[] = [];
    const blockRegex = /<(p|h2|h3|h4|h5|h6|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(containerHtml)) !== null) {
      const tag = match[1].toLowerCase();
      const rawContent = match[2];
      const innerBlocks = this.hasBlockLevelElements(rawContent);
      if (innerBlocks) continue;
      const txt = this.htmlToPlain(rawContent);
      if (txt.length >= 20) {
        const htmlBlock = this.sanitizeBlock(rawContent);
        blocks.push({ tag, text: txt, html: htmlBlock });
      }
    }

    if (blocks.length === 0) {
      const cleanContainer = this.removeAllTags(containerHtml);
      const fallback = this.htmlToPlain(cleanContainer);
      if (fallback.length < 40) return { text: '', html: '' };
      return { text: fallback, html: `<p>${fallback}</p>` };
    }

    const text = blocks.map(b => b.text).join('\n\n');
    const html = blocks.map(b => {
      if (b.tag === 'li') return `<li>${b.html}</li>`;
      if (['h2', 'h3', 'h4', 'h5', 'h6'].includes(b.tag)) return `<${b.tag}>${b.html}</${b.tag}>`;
      return `<p>${b.html}</p>`;
    }).join('\n');

    return { text, html };
  }

  private hasBlockLevelElements(html: string): boolean {
    return /<(p|h2|h3|h4|h5|h6|ul|ol|dl|table|blockquote|pre|div|section|article|header|footer|nav|aside)\b[^>]*>[\s\S]*?<\/\1>/gi.test(html);
  }

  private removeAllTags(html: string): string {
    return html
      .replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d{1,7});/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&hellip;/gi, '…')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeBlock(html: string): string {
    return html
      .replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d{1,7});/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&hellip;/gi, '…')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/<br\s*\/?>/gi, '<br>')
      .replace(/<a\b([^>]*)\>/gi, (_, attrs) => {
        const href = attrs.match(/href=["']([^"']+)["']/)?.[1] || '#';
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      })
      .replace(/<\/?(span|div|i|b|strong|em|u|strike|del|sup|sub)\b[^>]*>/gi, (m) => {
        const tag = m.match(/^<\/(\w+)/)?.[1];
        if (tag) return `</span>`;
        const opening = m.match(/^<(\w+)/)?.[1] || '';
        const attrs = m.match(/^<\w+\s+([^>]*)>/)?.[1] || '';
        return `<span${attrs ? ' ' + attrs : ''}>`;
      })
      .replace(/<(\w+)\b[^>]*>/g, '<span>')
      .replace(/<\/(\w+)[^>]*>/g, '</span>')
      .replace(/<span>\s*<\/span>/g, '')
      .replace(/<span>([^<]+)<\/span>/g, '$1')
      .replace(/<span><span>/g, '<span>')
      .replace(/<\/span><\/span>/g, '</span>')
      .replace(/<br>/g, '<br>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private htmlToPlain(html: string): string {
    return html
      .replace(/&#x([0-9a-fA-F]{1,6});/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d{1,7});/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&hellip;/gi, '…')
      .replace(/&mdash;/gi, '—')
      .replace(/&ndash;/gi, '–')
      .replace(/&copy;/gi, '©')
      .replace(/&reg;/gi, '®')
      .replace(/&trade;/gi, '™')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractArticleTitle(html: string): string {
    const titleFromHeading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const titleFromMeta = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    const titleFromTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

    const selected = titleFromHeading || titleFromMeta || titleFromTag || 'Article';
    return this.htmlToPlain(selected).substring(0, 255) || 'Article';
  }

  private isLikelyPaywall(content: string): boolean {
    const lowered = content.toLowerCase();
    const signals = [
      'subscribe',
      'sign in',
      'sign-in',
      'membership',
      'unlock this content',
      'continue reading',
      'already a subscriber',
      'start your trial',
    ];
    const hits = signals.filter(signal => lowered.includes(signal)).length;
    return hits >= 2 || content.length < 40;
  }
}

export function createNewsService(): NewsService {
  return new NewsService();
}

export const newsService = createNewsService();

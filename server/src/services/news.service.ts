import Parser from 'rss-parser';
import { prisma } from '../db/prisma.client';

const rssParser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'NightHub/1.0 RSS Reader' },
});

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

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
      console.error('Custom RSS fetch error:', e);
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
    console.log(`[News] Custom RSS ${domain}: ${items.length} items -> ${uniqueItems.length} unique`);
    uniqueItems.slice(0, 2).forEach((item: any, i: number) => {
      console.log(`  [${domain} ${i}] "${item.title?.substring(0,50)}" pubDate="${item.pubDate}" isoDate="${item.isoDate}"`);
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
    console.log(`[News] OpenAI RSS: ${items.length} items -> ${uniqueItems.length} unique`);
    uniqueItems.slice(0, 3).forEach((item: any, i: number) => {
      console.log(`  [OpenAI ${i}] title="${item.title?.substring(0,50)}" pubDate="${item.pubDate}" isoDate="${item.isoDate}"`);
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
    console.log('[News] Fetching Anthropic news...');
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

    console.log(`[News] Anthropic found ${articles.length} article paths, fetching individual pages for dates...`);

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

    console.log(`[News] Anthropic scraped: ${result.length} articles with dates`);
    result.slice(0, 3).forEach((a, i) => {
      console.log(`  [Anthropic ${i}] "${a.title?.substring(0,50)}" pubDate="${a.pubDate}"`);
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

      const surrounding = html.slice(linkMatch.index, linkMatch.index + 1500);
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

    console.log(`[News] Kimi scraped from index: ${articles.length} articles`);

    if (articles.length === 0) {
      console.log('[News] Kimi: No articles found on index page, trying fallback...');
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

    console.log(`[News] Kimi scraped: ${articles.length} articles`);
    articles.slice(0, 3).forEach((a, i) => {
      console.log(`  [Kimi ${i}] "${a.title?.substring(0,50)}" pubDate="${a.pubDate}"`);
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
        console.error('Cache news item error:', e);
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
}

export function createNewsService(): NewsService {
  return new NewsService();
}

export const newsService = createNewsService();
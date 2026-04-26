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

export class NewsService {
  async fetchAiNews(): Promise<any[]> {
    const [openai, anthropic, kimi, custom] = await Promise.allSettled([
      this.fetchOpenAI(),
      this.scrapeAnthropic(),
      this.scrapeKimi(),
      this.fetchCustomRssFeeds(),
    ]);

    const all = [
      ...(openai.status === 'fulfilled' ? openai.value : []),
      ...(anthropic.status === 'fulfilled' ? anthropic.value : []),
      ...(kimi.status === 'fulfilled' ? kimi.value : []),
      ...(custom.status === 'fulfilled' ? custom.value : []),
    ];

    if (all.length > 0) await this.cacheNews(all);

    return all.sort((a, b) =>
      new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
    );
  }

  /** Custom RSS feeds from user preferences */
  private async fetchCustomRssFeeds(): Promise<any[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      const raw = (pref as any)?.customRssFeeds || '';
      const urls = raw.split(/[\n,]/).map((u: string) => u.trim()).filter((u: string) => u.startsWith('http'));
      if (urls.length === 0) return [];

      const results = await Promise.allSettled(urls.map((url: string) => this.fetchSingleRss(url)));
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

  private async fetchSingleRss(url: string): Promise<any[]> {
    const feed = await rssParser.parseURL(url);
    const domain = new URL(url).hostname.replace('www.', '');
    const items = feed.items || [];
    console.log(`[News] Custom RSS ${domain}: ${items.length} items`);
    items.slice(0, 2).forEach((item: any, i: number) => {
      console.log(`  [${domain} ${i}] "${item.title?.substring(0,50)}" pubDate="${item.pubDate}" isoDate="${item.isoDate}"`);
    });
    return items.slice(0, 8).map((item: any) => ({
      title: (item.title || '').substring(0, 255),
      source: domain,
      url: item.link || url,
      summary: this.clean(item.contentSnippet || item.description || ''),
      isNew: this.isRecent(item.pubDate || item.isoDate),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    }));
  }

  /** OpenAI: use official RSS feed */
  private async fetchOpenAI(): Promise<any[]> {
    const feed = await rssParser.parseURL('https://openai.com/news/rss.xml');
    const items = feed.items || [];
    console.log(`[News] OpenAI RSS: ${items.length} items`);
    items.slice(0, 3).forEach((item: any, i: number) => {
      console.log(`  [OpenAI ${i}] title="${item.title?.substring(0,50)}" pubDate="${item.pubDate}" isoDate="${item.isoDate}"`);
    });
    return items.slice(0, 10).map((item: any) => ({
      title: item.title || 'OpenAI News',
      source: 'openai',
      url: item.link || 'https://openai.com/news',
      summary: this.clean(item.contentSnippet || item.description || ''),
      isNew: this.isRecent(item.pubDate || item.isoDate),
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
    }));
  }

  /** Anthropic: scrape https://www.anthropic.com/news */
  private async scrapeAnthropic(): Promise<any[]> {
    console.log('[News] Fetching Anthropic news...');
    const res = await fetch('https://www.anthropic.com/news', { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const html = await res.text();

    const articles: any[] = [];
    const seen = new Set<string>();

    // Pattern: find href="/news/slug" followed by title text nearby
    const regex = /href="(\/news\/([a-z0-9][a-z0-9\-]{3,60}))"/g;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(html)) !== null) {
      const [, path, slug] = m;
      if (seen.has(slug)) continue;
      seen.add(slug);

      // Extract title: look for text in surrounding 800 chars after the link
      const after = html.slice(m.index, m.index + 800);
      const titleMatch =
        after.match(/class="[^"]*title[^"]*"[^>]*>([^<]{10,150})</) ||
        after.match(/<h[23][^>]*>([^<]{10,150})<\/h[23]>/) ||
        after.match(/>[A-Z][^<]{10,120}</);

      // Also look before for headings
      const before = html.slice(Math.max(0, m.index - 500), m.index);
      const beforeH = before.match(/<h[23][^>]*>([^<]{10,150})<\/h[23]>(?!.*<h[23])/s);

      let title = (titleMatch?.[1] || beforeH?.[1] || '')
        .replace(/<[^>]+>/g, '')
        .trim();

      // Fallback: humanize slug
      if (!title || title.length < 8) {
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      if (title.length > 5) {
        // Try to find date near the link
        const dateMatch = after.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/);
        const pubDate = dateMatch ? new Date(dateMatch[0]).toISOString() : new Date().toISOString();

        articles.push({
          title,
          source: 'anthropic',
          url: `https://www.anthropic.com${path}`,
          summary: `Article Anthropic: ${title}`,
          isNew: this.isRecent(pubDate),
          pubDate,
        });
      }
    }

    console.log(`[News] Anthropic scraped: ${articles.length} articles`);
    articles.slice(0, 3).forEach((a, i) => {
      console.log(`  [Anthropic ${i}] "${a.title?.substring(0,50)}" pubDate="${a.pubDate}"`);
    });
    return articles.slice(0, 10);
  }

  /** Kimi: scrape https://www.kimi.com/blog/ */
  private async scrapeKimi(): Promise<any[]> {
    const res = await fetch('https://www.kimi.com/blog/', { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`Kimi HTTP ${res.status}`);
    const html = await res.text();

    const articles: any[] = [];
    const seen = new Set<string>();

    // Extract blog post links: /blog/something
    const regex = /href="(\/blog\/([^"/?#]{3,80}))"/g;
    let m: RegExpExecArray | null;

    while ((m = regex.exec(html)) !== null) {
      const [, path, slug] = m;
      if (slug === '' || seen.has(slug)) continue;
      seen.add(slug);

      const after = html.slice(m.index, m.index + 600);
      const titleMatch =
        after.match(/<h[123][^>]*>([^<]{5,120})<\/h[123]>/) ||
        after.match(/class="[^"]*title[^"]*"[^>]*>([^<]{5,120})</) ||
        after.match(/>([A-Z][a-zA-Z0-9\s\-:,\.]{10,100})</);

      let title = (titleMatch?.[1] || '').trim();
      if (!title || title.length < 5) {
        title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }

      // Date extraction
      const dateMatch = after.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
      const pubDate = dateMatch
        ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`).toISOString()
        : new Date().toISOString();

      if (title.length > 3) {
        articles.push({
          title,
          source: 'kimi',
          url: `https://www.kimi.com${path}`,
          summary: `Blog Kimi: ${title}`,
          isNew: this.isRecent(pubDate),
          pubDate,
        });
      }
    }

    console.log(`[News] Kimi scraped: ${articles.length} articles`);
    articles.slice(0, 3).forEach((a, i) => {
      console.log(`  [Kimi ${i}] "${a.title?.substring(0,50)}" pubDate="${a.pubDate}"`);
    });

    // Fallback with known articles if scraping returned nothing
    if (articles.length === 0) {
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

    return articles.slice(0, 10);
  }

  private clean(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim()
      .substring(0, 500);
  }

  private isRecent(date?: string): boolean {
    if (!date) return false;
    const diffH = (Date.now() - new Date(date).getTime()) / 3600000;
    return diffH < 72;
  }

  private async cacheNews(items: any[]): Promise<void> {
    for (const item of items) {
      try {
        if (!item.url || !item.title) continue;
        const exists = await prisma.aiNewsItem.findFirst({ where: { url: item.url } });
        if (!exists) {
          await prisma.aiNewsItem.create({
            data: {
              title: item.title.substring(0, 255),
              source: item.source,
              url: item.url,
              summary: (item.summary || '').substring(0, 500),
              pubDate: new Date(item.pubDate || new Date()),
              isNew: item.isNew ?? false,
            },
          });
        }
      } catch (e) {
        console.error('Cache news item error:', e);
      }
    }
  }

  async getCachedNews(limit: number = 20): Promise<any[]> {
    try {
      return await prisma.aiNewsItem.findMany({
        take: limit,
        orderBy: { pubDate: 'desc' },
      });
    } catch {
      return [];
    }
  }

  /** Validate that a URL is a valid RSS/Atom feed */
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

  /** Detect RSS/Atom feed for a given site URL */
  async detectFeed(siteUrl: string): Promise<string | null> {
    try {
      // 1. Fetch the page and look for <link type="application/rss+xml">
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
      // fall through to probing
    }

    // 2. Probe common paths
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

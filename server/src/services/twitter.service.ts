import { prisma } from '../db/prisma.client';
import Parser from 'rss-parser';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  customFields: { item: ['dc:creator'] },
});

const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
];

export class TwitterService {
  /** Get the list of Twitter accounts to monitor from preferences */
  async getTwitterAccounts(): Promise<string[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      const csv = (pref as any)?.twitterAccounts || '';
      return csv.split(',').map((s: string) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Fetch RSS from Nitter for a single username, with fallback instances */
  private async fetchNitterRSS(username: string): Promise<any[]> {
    for (const instance of NITTER_INSTANCES) {
      try {
        const url = `${instance}/${username}/rss`;
        const feed = await rssParser.parseURL(url);
        const items = (feed.items || []).slice(0, 20);
        if (items.length > 0) {
          return items.map((item: any) => ({
            twitterId: item.guid || item.link || String(Date.now()),
            authorName: item['dc:creator'] || `@${username}`,
            authorHandle: `@${username}`,
            authorAvatar: `https://unavatar.io/twitter/${username}`,
            content: this.cleanContent(item.title || ''),
            likes: 0,
            retweets: 0,
            pubDate: item.pubDate,
            createdAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          }));
        }
      } catch (e) {
        console.error(`Nitter ${instance} error for ${username}:`, (e as Error).message);
      }
    }
    return [];
  }

  /** Process items in batches with limited concurrency */
  private async batchSettled<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number = 25,
    onBatch?: (done: number, total: number) => void,
  ): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      results.push(...await Promise.allSettled(batch.map(fn)));
      onBatch?.(Math.min(i + concurrency, items.length), items.length);
    }
    return results;
  }

  private async isCacheStale(maxAgeMinutes = 30): Promise<boolean> {
    try {
      const latest = await prisma.tweet.findFirst({ orderBy: { fetchedAt: 'desc' } });
      if (!latest) return true;
      return (Date.now() - new Date(latest.fetchedAt).getTime()) > maxAgeMinutes * 60 * 1000;
    } catch {
      return true;
    }
  }

  /** Scrape Nitter for all accounts and cache results */
  private async refreshTimeline(): Promise<void> {
    try {
      const accounts = await this.getTwitterAccounts();
      if (accounts.length === 0) return;

      const results = await this.batchSettled(
        accounts,
        (username: string) => this.fetchNitterRSS(username),
        25,
      );

      const all: any[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') all.push(...result.value);
      }

      if (all.length === 0) return;

      all.sort((a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime());
      await this.cacheTweets(all.slice(0, 20));
    } catch (e) {
      console.error('Twitter refresh error:', e);
    }
  }

  /** Get aggregated tweets from all configured accounts, sorted by date */
  async getTimeline(limit: number = 20, onProgress?: (done: number, total: number) => void): Promise<any[]> {
    const cached = await this.getCachedTweets(limit);
    const stale = await this.isCacheStale(30);
    if (stale) {
      setImmediate(() => this.refreshTimeline().catch(console.error));
    }
    return cached;
  }

  private cleanContent(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async cacheTweets(tweets: any[]): Promise<void> {
    try {
      for (const t of tweets) {
        const id = String(t.twitterId).substring(0, 100);
        await prisma.tweet.upsert({
          where: { twitterId: id },
          update: { content: t.content, likes: t.likes, retweets: t.retweets },
          create: {
            twitterId: id,
            authorName: t.authorName,
            authorHandle: t.authorHandle,
            authorAvatar: t.authorAvatar,
            content: t.content,
            likes: t.likes,
            retweets: t.retweets,
          },
        });
      }
    } catch (e) {
      console.error('Cache tweets error:', e);
    }
  }

  async getCachedTweets(limit: number = 20): Promise<any[]> {
    try {
      const tweets = await prisma.tweet.findMany({
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
      if (tweets.length > 0) return tweets;
    } catch {
      // fall through to empty
    }
    return [];
  }

  async getUserTweets(username: string, limit: number = 10): Promise<any[]> {
    const items = await this.fetchNitterRSS(username);
    return items.slice(0, limit);
  }

  /** Legacy OAuth stubs */
  getAuthUrl(): string { return ''; }
  async exchangeCodeForTokens(_code: string): Promise<boolean> { return false; }
  async isConnected(): Promise<boolean> {
    const accounts = await this.getTwitterAccounts();
    return accounts.length > 0;
  }
  async disconnect(): Promise<void> {
    try {
      const existing = await prisma.userPreference.findFirst();
      if (existing) {
        await prisma.userPreference.update({ where: { id: existing.id }, data: { twitterAccounts: '' } });
      }
    } catch {}
  }
}

export const twitterService = new TwitterService();

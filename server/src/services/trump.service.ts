import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';
import Parser from 'rss-parser';
import {
  scoreTrumpContent,
  type TrumpScoringProfile,
} from './trump.scoring';
import { buildTrumpTrainedProfile } from './trump.training';
import { annotateTrumpSeverity, isTrumpBreaking } from './trump-severity';
import { trumpTrainingService } from './trump.trainer';
import { loadTrumpArchiveCorpusFromPath, resolveTrumpArchiveDatasetPath } from './trump.archive';
import { scoreTrumpTextWeakly } from './trump.weak-scorer';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
    'Accept-Language': 'en-US,en;q=0.9',
  },
});

const TRUMP_NITTER_URLS = [
  'https://nitter.net/realDonaldTrump/rss',
  'https://nitter.poast.org/realDonaldTrump/rss',
];

const TRUTHSOCIAL_API_URL = 'https://truthsocial.com/api/v1/accounts/107780257626128497/statuses';
const SCRAPECREATORS_API_URL = 'https://api.scrapecreators.com/v1/truthsocial/user/posts';
const HISTORICAL_FETCH_TARGET = 250;
const PAGE_FETCH_SIZE = 40;

/** Max 10 refreshes/day = minimum 144 min between API calls */
const MIN_REFRESH_INTERVAL_MS = 144 * 60 * 1000;
let lastRefreshedAt = 0;
let lastScoringProfileLoadedAt = 0;
let cachedScoringProfile: TrumpScoringProfile = buildTrumpTrainedProfile([], trumpTrainingService.getPersistedProfile());
let cachedArchiveFallback: any[] | null = null;

function getScrapeCreatorsApiKey(): string {
  return process.env.SCRAPECREATORS_API_KEY || '';
}

function shouldRefresh(): boolean {
  return Date.now() - lastRefreshedAt >= MIN_REFRESH_INTERVAL_MS;
}

function shouldDebugTrumpPosts(): boolean {
  return process.env.TRUMP_DEBUG_POSTS === 'true';
}

function shouldDisableArchiveFallback(): boolean {
  return process.env.TRUMP_DISABLE_ARCHIVE_FALLBACK === 'true';
}

const CRITICAL_KEYWORDS = {
  high: [
    'nuclear', 'war', 'attack', 'emergency', 'executive order', 'martial law',
    'impeach', 'indicted', 'arrested', 'sanctions', 'troops', 'military',
    'invasion', 'shutdown', 'crisis', 'fired', 'resign', 'tariff', 'ban',
    'deport', 'border', 'threat', 'bomb', 'missiles', 'nato', 'russia',
    'china', 'iran', 'north korea', 'nuclear',
  ],
  medium: [
    'deal', 'trade', 'congress', 'supreme court', 'election', 'vote',
    'economy', 'inflation', 'billion', 'trillion', 'tax', 'regulation',
    'crypto', 'bitcoin', 'investigation', 'subpoena', 'hearing', 'testimony',
    'ukraine', 'israel', 'ceasefire', 'wall street', 'federal reserve',
  ],
  low: [
    'fake news', 'media', 'rating', 'great', 'tremendous', 'beautiful',
    'best', 'winning', 'loser', 'sad', 'thank you', 'congratulations',
    'endorsement', 'rally', 'maga', 'witch hunt', 'hoax',
  ],
};

const SENTIMENT_NEG = [
  'disaster', 'terrible', 'worst', 'corrupt', 'crooked', 'disgrace',
  'failed', 'pathetic', 'weak', 'fraud', 'scam', 'witch hunt', 'hoax',
  'rigged', 'shame', 'threat', 'danger', 'attack', 'enemy',
];
const SENTIMENT_POS = [
  'great', 'tremendous', 'beautiful', 'best', 'winning', 'success',
  'incredible', 'amazing', 'fantastic', 'wonderful', 'proud', 'strong',
  'victory', 'achievement', 'record', 'historic',
];

export class TrumpService {
  async fetchTrumpTweets(limit: number = 20): Promise<any[]> {
    await this.refreshScoringProfile();
    const fetchTarget = Math.max(limit, HISTORICAL_FETCH_TARGET);

    // Enforce max 10 refreshes/day — skip if data is recent
    if (!shouldRefresh()) {
      logger.info('[Trump] Skipping refresh — data is recent (< 2.4h)');
      return this.getCachedTrumpTweets(limit);
    }

    // 1. ScrapeCreators API (if key configured)
    const scrapeKey = getScrapeCreatorsApiKey();
    if (scrapeKey) {
      try {
        const items = await this.fetchScrapeCreatorsPosts(fetchTarget, scrapeKey);
        if (items.length > 0) {
          lastRefreshedAt = Date.now();
          return items.slice(0, limit);
        }
      } catch (e) {
        logger.error('ScrapeCreators fetch failed, trying Truth Social direct', e);
      }
    }

    // 2. Truth Social direct API
    try {
      const items = await this.fetchTruthSocialPosts(fetchTarget);
      if (items.length > 0) {
        lastRefreshedAt = Date.now();
        return items.slice(0, limit);
      }
    } catch (e) {
      logger.error('Truth Social fetch failed, falling back to Nitter', e);
    }

    // 3. Nitter RSS fallback
    for (const url of TRUMP_NITTER_URLS) {
      try {
        const feed = await rssParser.parseURL(url);
        const items = (feed.items || []).slice(0, limit);
        logger.info('[Trump] RSS fetch', { url, itemCount: items.length });
        items.slice(0, 3).forEach((item: any, i: number) => {
          logger.debug('[Trump] Item', {
        index: i,
        pubDate: item.pubDate,
        title: item.title?.substring(0, 60),
      });
        });
        if (items.length === 0) continue;

        const analyzed = items.map(item => this.analyzeItem(item));
        await this.cacheTrumpTweets(analyzed);
        lastRefreshedAt = Date.now();

        return analyzed.sort((a, b) => b.criticality - a.criticality);
      } catch (e) {
        logger.error(`Trump Nitter error (${url})`, e);
      }
    }

    return this.getCachedTrumpTweets(limit);
  }

  private async fetchScrapeCreatorsPosts(limit: number, apiKey: string): Promise<any[]> {
    const url = `${SCRAPECREATORS_API_URL}?user_id=107780257626128497&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`ScrapeCreators API returned ${response.status}`);
    }

    const data = await response.json();
    const posts: any[] = data?.data || data?.posts || (Array.isArray(data) ? data : []);

    if (!Array.isArray(posts) || posts.length === 0) {
      logger.warn('[Trump] ScrapeCreators returned empty posts');
      return [];
    }

    logger.info('[Trump] ScrapeCreators fetch', { postCount: posts.length });
    this.debugRawPosts('scrapecreators', posts);
    const analyzed = posts.map(post => this.analyzeTruthSocialPost(post));
    await this.cacheTrumpTweets(analyzed);
    return analyzed.sort((a, b) => b.criticality - a.criticality);
  }

  private async fetchTruthSocialPosts(limit: number = 20): Promise<any[]> {
    const posts = await this.fetchTruthSocialArchive(limit);
    if (!Array.isArray(posts) || posts.length === 0) {
      logger.warn('[Trump] Truth Social returned empty posts');
      return [];
    }

    logger.info('[Trump] Truth Social fetch', { postCount: posts.length });
    this.debugRawPosts('truthsocial', posts);

    const analyzed = posts.map(post => this.analyzeTruthSocialPost(post));
    await this.cacheTrumpTweets(analyzed);

    return analyzed.sort((a, b) => b.criticality - a.criticality);
  }

  private async fetchTruthSocialArchive(targetCount: number): Promise<any[]> {
    const posts: any[] = [];
    let maxId: string | null = null;
    let safety = 0;

    while (posts.length < targetCount && safety < 12) {
      const page = await this.fetchTruthSocialPage(Math.min(PAGE_FETCH_SIZE, targetCount - posts.length), maxId);
      if (page.length === 0) break;

      posts.push(...page);
      const lastPost = page[page.length - 1];
      maxId = lastPost?.id ? String(lastPost.id) : null;
      safety += 1;

      if (page.length < PAGE_FETCH_SIZE || !maxId) break;
    }

    return this.dedupePosts(posts).slice(0, targetCount);
  }

  private async fetchTruthSocialPage(limit: number, maxId: string | null): Promise<any[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      exclude_replies: 'true',
      with_muted: 'true',
    });
    if (maxId) params.set('max_id', maxId);

    const response = await fetch(`${TRUTHSOCIAL_API_URL}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Truth Social API returned ${response.status}`);
    }

    const posts: any[] = await response.json();
    return Array.isArray(posts) ? posts : [];
  }

  private analyzeTruthSocialPost(post: any): any {
    const rawContent = post.content || post.text || post.content_text || '';
    const content = this.stripHtml(rawContent);
    const lower = content.toLowerCase();
    const media = this.extractMedia(post);
    const isImageOnly = content.length === 0 && media.kind === 'image';

    const criticality = this.scoreCriticality(content, {
      likes: post.favourites_count || post.favorites_count || post.likes_count || 0,
      retweets: post.reblogs_count || post.reposts_count || post.shares_count || 0,
    });
    const sentiment = this.analyzeSentiment(lower);
    const type = this.classifyType(lower);
    const keywords = this.extractKeywords(lower).slice(0, 5).join(',');
    const isBreaking = isTrumpBreaking(criticality);

    const postId = String(post.id || post.post_id || '');
    const tweetId = postId.replace(/\D/g, '').slice(-18) || String(Date.now());

    const createdAt = post.created_at || post.createdAt || post.timestamp;

    return annotateTrumpSeverity({
      tweetId,
      content,
      rawContent,
      type,
      criticality,
      sentiment,
      keywords,
      likes: post.favourites_count || post.favorites_count || post.likes_count || 0,
      retweets: post.reblogs_count || post.reposts_count || post.shares_count || 0,
      isBreaking,
      source: 'truthsocial',
      mediaUrls: media.urls.join('\n'),
      mediaType: media.kind,
      isImageOnly,
      rawPayload: JSON.stringify(post),
      url: post.url || post.link || `https://truthsocial.com/@realDonaldTrump/posts/${postId}`,
      tweetDate: createdAt ? new Date(createdAt) : new Date(),
    });
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private analyzeItem(item: any): any {
    const raw = (item.title || '') + ' ' + (item.contentSnippet || '');
    const content = this.cleanContent(raw);
    const lower = content.toLowerCase();

    const criticality = this.scoreCriticality(content, {
      likes: 0,
      retweets: 0,
    });
    const sentiment = this.analyzeSentiment(lower);
    const type = this.classifyType(lower);
    const keywords = this.extractKeywords(lower).slice(0, 5).join(',');
    const isBreaking = isTrumpBreaking(criticality);

    // Extract tweet ID from nitter URL
    const tweetId = (item.guid || item.link || '')
      .replace(/.*\/status\//, '')
      .replace(/#.*/, '')
      .trim() || String(Date.now());

    return annotateTrumpSeverity({
      tweetId,
      content,
      rawContent: raw,
      type,
      criticality,
      sentiment,
      keywords,
      likes: 0,
      retweets: 0,
      isBreaking,
      source: 'nitter-rss',
      mediaUrls: '',
      mediaType: '',
      isImageOnly: false,
      rawPayload: JSON.stringify(item),
      url: (item.link || '').replace('nitter.net', 'x.com').replace('/status/', '/status/'),
      tweetDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    });
  }

  private cleanContent(text: string): string {
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }

  private async refreshScoringProfile(): Promise<void> {
    const now = Date.now();
    if (now - lastScoringProfileLoadedAt < 15 * 60 * 1000) return;

    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const corpus = await prisma.trumpTweet.findMany({
        where: { tweetDate: { gte: cutoff } },
        orderBy: [{ tweetDate: 'desc' }],
        take: 300,
        select: {
          content: true,
          criticality: true,
          isBreaking: true,
          likes: true,
          retweets: true,
          tweetDate: true,
          type: true,
          keywords: true,
        } as any,
      }) as any[];

      cachedScoringProfile = buildTrumpTrainedProfile(
        corpus as any,
        trumpTrainingService.getPersistedProfile(),
      );
      lastScoringProfileLoadedAt = now;
      logger.info('[Trump] Scoring profile refreshed', { corpusSize: corpus.length });
    } catch (error) {
      logger.warn('[Trump] Failed to refresh scoring profile', {
        error: error instanceof Error ? error.message : String(error),
      });
      cachedScoringProfile = buildTrumpTrainedProfile([], trumpTrainingService.getPersistedProfile());
      lastScoringProfileLoadedAt = now;
    }
  }

  private analyzeSentiment(lower: string): string {
    const neg = SENTIMENT_NEG.filter(w => lower.includes(w)).length;
    const pos = SENTIMENT_POS.filter(w => lower.includes(w)).length;
    if (neg > pos) return 'negative';
    if (pos > neg) return 'positive';
    return 'neutral';
  }

  private classifyType(lower: string): string {
    if (lower.includes('executive order') || lower.includes('signed') || lower.includes('ordered')) return 'decision';
    if (lower.includes('investigation') || lower.includes('indicted') || lower.includes('arrest')) return 'scandal';
    if (lower.includes('statement') || lower.includes('announced') || lower.includes('press')) return 'statement';
    return 'tweet';
  }

  private extractKeywords(lower: string): string[] {
    return [
      ...CRITICAL_KEYWORDS.high,
      ...CRITICAL_KEYWORDS.medium,
    ].filter(kw => lower.includes(kw));
  }

  private extractMedia(post: any): { kind: string; urls: string[] } {
    const attachments = Array.isArray(post?.media_attachments) ? post.media_attachments : [];
    const urls = attachments
      .map((attachment: any) => attachment?.url || attachment?.preview_url || attachment?.remote_url)
      .filter((url: string | undefined): url is string => Boolean(url));
    const kind = attachments[0]?.type || '';

    return { kind, urls };
  }

  private dedupePosts(posts: any[]): any[] {
    const seen = new Set<string>();
    return posts.filter((post) => {
      const id = String(post?.id || post?.post_id || post?.uri || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  private debugRawPosts(source: string, posts: any[]): void {
    if (!shouldDebugTrumpPosts()) return;

    console.log(`[Trump][${source}] fetched ${posts.length} raw posts`);
    posts.forEach((post, index) => {
      console.log(`[Trump][${source}][${index}]`, JSON.stringify(post, null, 2));
    });
  }

  private scoreCriticality(content: string, meta: { likes?: number; retweets?: number } = {}): number {
    const weakScore = scoreTrumpTextWeakly(content);
    const heuristicScore = scoreTrumpContent(content, cachedScoringProfile, meta);
    const gap = Math.abs(heuristicScore - weakScore.score);

    if (gap >= 4) {
      return Math.max(0, Math.min(10, Math.round(((heuristicScore) + (2 * weakScore.score)) / 3)));
    }

    return Math.max(0, Math.min(10, Math.round((0.55 * weakScore.score) + (0.45 * heuristicScore))));
  }

  private getArchiveFallbackTweets(limit: number): any[] {
    if (shouldDisableArchiveFallback()) return [];
    if (!cachedArchiveFallback) {
      const datasetPath = resolveTrumpArchiveDatasetPath();
      if (!datasetPath) {
        cachedArchiveFallback = [];
      } else {
        const records = loadTrumpArchiveCorpusFromPath(datasetPath);
        cachedArchiveFallback = records
          .filter((record) => record.content.trim().length > 0)
          .slice(0, Math.max(100, limit))
          .map((record, index) => this.analyzeArchiveRecord(record, index));
      }
    }

    return cachedArchiveFallback.slice(0, limit);
  }

  private analyzeArchiveRecord(record: any, index: number): any {
    const content = this.cleanContent(record.content || '');
    const lower = content.toLowerCase();
    const criticality = this.scoreCriticality(content, {
      likes: record.likes || 0,
      retweets: record.retweets || 0,
    });
    const tweetDate = record.tweetDate ? new Date(record.tweetDate) : new Date();

    return annotateTrumpSeverity({
      tweetId: `archive-${tweetDate.getTime()}-${index}`,
      content,
      rawContent: content,
      type: this.classifyType(lower),
      criticality,
      sentiment: this.analyzeSentiment(lower),
      keywords: this.extractKeywords(lower).slice(0, 5).join(','),
      likes: record.likes || 0,
      retweets: record.retweets || 0,
      isBreaking: isTrumpBreaking(criticality),
      source: 'local-archive',
      mediaUrls: '',
      mediaType: '',
      isImageOnly: false,
      rawPayload: JSON.stringify(record),
      url: '#',
      tweetDate,
    });
  }

  private async cacheTrumpTweets(tweets: any[]): Promise<void> {
    // Purge old cached data (> 30 days) before inserting fresh posts
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await prisma.trumpTweet.deleteMany({
        where: { tweetDate: { lt: cutoff } },
      });
      if (deleted.count > 0) {
        logger.info('[Trump] Purged old cached tweets', { count: deleted.count });
      }
    } catch (e) {
      logger.error('Purge old trump tweets error', e);
    }

    for (const t of tweets) {
      try {
        const data = {
          content: t.content,
          type: t.type,
          criticality: t.criticality,
          sentiment: t.sentiment,
          keywords: t.keywords,
          likes: t.likes,
          retweets: t.retweets,
          isBreaking: t.isBreaking,
          url: t.url,
          tweetDate: t.tweetDate,
        };

        await prisma.trumpTweet.upsert({
          where: { tweetId: t.tweetId },
          update: data,
          create: {
            tweetId: t.tweetId,
            ...data,
            content: t.content.substring(0, 1000),
          },
        });
      } catch (e) {
        logger.error('Cache trump tweet error', e);
      }
    }

    lastScoringProfileLoadedAt = 0;
  }

  async getCachedTrumpTweets(limit: number = 20): Promise<any[]> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tweets = await prisma.trumpTweet.findMany({
        where: {
          tweetDate: { gte: cutoff },
          content: { not: '' },
        } as any,
        take: limit,
        orderBy: [{ tweetDate: 'desc' }],
      });
      if (tweets.length > 0) {
        return tweets.map((tweet) => {
          const criticality = this.scoreCriticality(tweet.content, {
            likes: tweet.likes,
            retweets: tweet.retweets,
          });

          return annotateTrumpSeverity({
            ...tweet,
            criticality,
            isBreaking: isTrumpBreaking(criticality),
          });
        });
      }
    } catch (e) {
      logger.error('Get cached trump tweets error', e);
    }
    const fallback = this.getArchiveFallbackTweets(limit);
    if (fallback.length > 0) {
      logger.info('[Trump] Serving local archive fallback tweets', { count: fallback.length });
    }
    return fallback;
  }

  analyzeTweet(tweet: any): any {
    return this.analyzeItem(tweet);
  }
}

export function createTrumpService(): TrumpService {
  return new TrumpService();
}

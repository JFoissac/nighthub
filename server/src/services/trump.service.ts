import { prisma } from '../db/prisma.client';
import Parser from 'rss-parser';

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
    for (const url of TRUMP_NITTER_URLS) {
      try {
        const feed = await rssParser.parseURL(url);
        const items = (feed.items || []).slice(0, limit);
        if (items.length === 0) continue;

        const analyzed = items.map(item => this.analyzeItem(item));
        await this.cacheTrumpTweets(analyzed);

        return analyzed.sort((a, b) => b.criticality - a.criticality);
      } catch (e) {
        console.error(`Trump Nitter error (${url}):`, (e as Error).message);
      }
    }

    return this.getCachedTrumpTweets(limit);
  }

  private analyzeItem(item: any): any {
    const raw = (item.title || '') + ' ' + (item.contentSnippet || '');
    const content = this.cleanContent(raw);
    const lower = content.toLowerCase();

    const criticality = this.calcCriticality(lower);
    const sentiment = this.analyzeSentiment(lower);
    const type = this.classifyType(lower);
    const keywords = this.extractKeywords(lower).slice(0, 5).join(',');
    const isBreaking = criticality >= 7;

    // Extract tweet ID from nitter URL
    const tweetId = (item.guid || item.link || '')
      .replace(/.*\/status\//, '')
      .replace(/#.*/, '')
      .trim() || String(Date.now());

    return {
      tweetId,
      content,
      type,
      criticality,
      sentiment,
      keywords,
      likes: 0,
      retweets: 0,
      isBreaking,
      url: (item.link || '').replace('nitter.net', 'x.com').replace('/status/', '/status/'),
      tweetDate: item.pubDate ? new Date(item.pubDate) : new Date(),
    };
  }

  private cleanContent(text: string): string {
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim();
  }

  private calcCriticality(lower: string): number {
    let score = 0;
    for (const kw of CRITICAL_KEYWORDS.high) if (lower.includes(kw)) score += 3;
    for (const kw of CRITICAL_KEYWORDS.medium) if (lower.includes(kw)) score += 2;
    for (const kw of CRITICAL_KEYWORDS.low) if (lower.includes(kw)) score += 1;
    // Caps and exclamation
    const excl = (lower.match(/!/g) || []).length;
    score += Math.min(excl, 3);
    return Math.min(10, Math.round(score));
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

  private async cacheTrumpTweets(tweets: any[]): Promise<void> {
    for (const t of tweets) {
      try {
        await prisma.trumpTweet.upsert({
          where: { tweetId: t.tweetId },
          update: {
            content: t.content,
            type: t.type,
            criticality: t.criticality,
            sentiment: t.sentiment,
            keywords: t.keywords,
            likes: t.likes,
            retweets: t.retweets,
            isBreaking: t.isBreaking,
            url: t.url,
          },
          create: {
            tweetId: t.tweetId,
            content: t.content.substring(0, 1000),
            type: t.type,
            criticality: t.criticality,
            sentiment: t.sentiment,
            keywords: t.keywords,
            likes: t.likes,
            retweets: t.retweets,
            isBreaking: t.isBreaking,
            url: t.url,
            tweetDate: t.tweetDate,
          },
        });
      } catch (e) {
        console.error('Cache trump tweet error:', e);
      }
    }
  }

  async getCachedTrumpTweets(limit: number = 20): Promise<any[]> {
    try {
      const tweets = await prisma.trumpTweet.findMany({
        take: limit,
        orderBy: [{ criticality: 'desc' }, { tweetDate: 'desc' }],
      });
      if (tweets.length > 0) return tweets;
    } catch (e) {
      console.error('Get cached trump tweets error:', e);
    }
    return [];
  }

  analyzeTweet(tweet: any): any {
    return this.analyzeItem(tweet);
  }
}

export function createTrumpService(): TrumpService {
  return new TrumpService();
}

export const trumpService = createTrumpService();

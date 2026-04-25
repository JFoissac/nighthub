import cron from 'node-cron';
import { weatherService } from './weather.service';
import { newsService } from './news.service';
import { twitterService } from './twitter.service';
import { youtubeService } from './youtube.service';
import { twitchService } from './twitch.service';
import { trumpService } from './trump.service';

export class AggregatorService {
  constructor() {
    this.initCronJobs();
  }

  private initCronJobs(): void {
    // Refresh all data every 30 minutes
    cron.schedule('*/30 * * * *', () => {
      console.log('[Cron] Refreshing all data...');
      this.refreshAll();
    });

    // Check Twitch live status every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      console.log('[Cron] Checking Twitch streams...');
      this.refreshTwitch();
    });

    // Refresh Trump tweets every 15 minutes
    cron.schedule('*/15 * * * *', () => {
      console.log('[Cron] Refreshing Trump tweets...');
      this.refreshTrump();
    });

    console.log('[Aggregator] Cron jobs initialized');
  }

  async refreshAll(): Promise<void> {
    try {
      await Promise.allSettled([
        weatherService.getWeeklyForecast('Caen'),
        newsService.fetchAiNews(),
        twitterService.getTimeline(20),
        youtubeService.fetchAndCacheLatestVideos(),
        twitchService.getFollowedStreams(),
        trumpService.fetchTrumpTweets(20),
      ]);
      console.log('[Aggregator] All data refreshed successfully');
    } catch (error) {
      console.error('[Aggregator] Error refreshing all data:', error);
    }
  }

  async refreshTwitch(): Promise<void> {
    try {
      await twitchService.getFollowedStreams();
    } catch (error) {
      console.error('[Aggregator] Error refreshing Twitch:', error);
    }
  }

  async refreshTrump(): Promise<void> {
    try {
      await trumpService.fetchTrumpTweets(20);
    } catch (error) {
      console.error('[Aggregator] Error refreshing Trump:', error);
    }
  }

  calculateRelevanceScore(item: any, type: string): number {
    const now = new Date();
    let ageHours = 0;
    let maxAge = 24;

    if (item.fetchedAt) {
      ageHours = (now.getTime() - new Date(item.fetchedAt).getTime()) / (1000 * 60 * 60);
    } else if (item.createdAt) {
      ageHours = (now.getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    }

    switch (type) {
      case 'video':
        maxAge = 168;
        break;
      case 'news':
        maxAge = 1;
        break;
      case 'stream':
        maxAge = 48;
        break;
      case 'trump':
        maxAge = 12;
        break;
      default:
        maxAge = 24;
    }

    const recencyScore = Math.max(0, 1 - ageHours / maxAge);

    let engagementScore = 0;
    if (item.likes) engagementScore += Math.log10(item.likes + 1) / 10;
    if (item.retweets) engagementScore += Math.log10(item.retweets + 1) / 10;
    if (item.views) engagementScore += Math.log10(item.views + 1) / 10;
    if (item.viewerCount) engagementScore += Math.log10(item.viewerCount + 1) / 10;

    const score = 0.5 * recencyScore + 0.3 * engagementScore + 0.2;

    return Math.min(1, Math.max(0, score));
  }

  sortByRelevance(items: any[], type: string): any[] {
    return items
      .map(item => ({
        ...item,
        relevanceScore: this.calculateRelevanceScore(item, type),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getDashboardData(onProgress?: (step: string) => void): Promise<any> {
    try {
      const { prisma } = await import('../db/prisma.client');
      const prefs = await prisma.userPreference.findFirst();
      const weatherCity = prefs?.weatherCity || 'Caen';
      const trumpMinCriticality = prefs?.trumpMinCriticality || 0;

      onProgress?.('Loading weather...');
      const weather = await weatherService.getWeeklyForecast(weatherCity).catch(() => null);

      // Fast sources in parallel
      onProgress?.('Loading streams, videos, news...');
      const [streams, videos, news, trump] = await Promise.allSettled([
        twitchService.getFollowedStreams(),
        youtubeService.getLatestVideos(),
        newsService.getCachedNews(20),
        trumpService.getCachedTrumpTweets(20),
      ]);

      const tweetsResult = await twitterService.getTimeline(20).catch(() => [] as any[]);

      onProgress?.('Done');

      // Filter trump tweets by min criticality preference
      let trumpData = trump.status === 'fulfilled' ? trump.value : [];
      if (trumpMinCriticality > 0) {
        trumpData = trumpData.filter((t: any) => t.criticality >= trumpMinCriticality);
      }

      return {
        weather,
        tweets: this.sortByRelevance(tweetsResult, 'tweet'),
        streams: streams.status === 'fulfilled' ? streams.value : [],
        videos: videos.status === 'fulfilled' ? this.sortByRelevance(videos.value, 'video') : [],
        news: news.status === 'fulfilled' ? this.sortByRelevance(news.value, 'news') : [],
        trump: trumpData,
        refreshedAt: new Date(),
      };
    } catch (error) {
      console.error('[Aggregator] Error getting dashboard data:', error);
      return {
        weather: null,
        tweets: [],
        streams: [],
        videos: [],
        news: [],
        trump: [],
        refreshedAt: new Date(),
      };
    }
  }
}

export const aggregatorService = new AggregatorService();

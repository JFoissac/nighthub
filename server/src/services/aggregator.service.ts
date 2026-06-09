import cron from 'node-cron';
import { weatherService } from './weather.service';
import { newsService } from './news.service';
import { youtubeService } from './youtube.service';
import { twitchService } from './twitch.service';
import { trumpService } from './trump.service';
import { marketService } from './market.service';
import { logger } from '../utils/logger';
import { RELEVANCE } from '../config/constants';

export class AggregatorService {
  private cronInitialized = false;
  private isShuttingDown = false;

  start(): void {
    if (this.cronInitialized) {
      return;
    }
    this.cronInitialized = true;
    this.initCronJobs();
    logger.info('Aggregator cron jobs started');
  }

  stop(): void {
    this.isShuttingDown = true;
    this.cronInitialized = false;
    logger.info('Aggregator cron jobs stopped');
  }

  private initCronJobs(): void {
    // Refresh all data every 30 minutes
    cron.schedule('*/30 * * * *', () => {
      if (this.isShuttingDown) return;
      logger.info('Cron: Refreshing all data');
      this.refreshAll();
    });

    // Check Twitch live status every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      if (this.isShuttingDown) return;
      logger.debug('Cron: Checking Twitch streams');
      this.refreshTwitch();
    });

    // Verify YouTube live stream status every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      if (this.isShuttingDown) return;
      logger.debug('Cron: Verifying YouTube live streams');
      youtubeService.verifyAndCleanLiveStreams().catch((e) => logger.error('Verify live streams failed', e));
    });

    // Refresh Trump tweets every 15 min (actual API capped at 10x/day by shouldRefresh)
    cron.schedule('*/15 * * * *', () => {
      if (this.isShuttingDown) return;
      logger.debug('Cron: Refreshing Trump tweets');
      this.refreshTrump();
    });

    logger.info('Aggregator cron jobs initialized');
  }

  async refreshAll(): Promise<void> {
    try {
      const tasks = [
        { name: 'weather', promise: weatherService.getWeeklyForecast('Caen') },
        { name: 'news', promise: newsService.fetchAiNews() },
        { name: 'youtube', promise: youtubeService.fetchAndCacheLatestVideos() },
        { name: 'twitch', promise: twitchService.getFollowedStreams() },
        { name: 'trump', promise: trumpService.fetchTrumpTweets(20) },
      ];
      const results = await Promise.allSettled(tasks.map(task => task.promise));
      const failures = results
        .map((result, index) => {
          if (result.status === 'fulfilled') {
            return null;
          }
          const reason = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          return {
            task: tasks[index].name,
            reason,
          };
        })
        .filter((failure): failure is { task: string; reason: string } => failure !== null);

      if (failures.length > 0) {
        console.warn(
          `[Aggregator] Partial data refresh failure (${failures.length}/${tasks.length}):`,
          failures,
        );
        return;
      }

      logger.info('All data refreshed successfully');
    } catch (error) {
      logger.error('Error refreshing all data', error);
    }
  }

  async refreshTwitch(): Promise<void> {
    try {
      const result = await twitchService.refreshLiveCacheLight();
      if (!result.changed) {
        logger.debug('Twitch check: no changes', { totalLive: result.totalLive });
        return;
      }
      logger.info('Twitch check updated', {
        newLives: result.newLives,
        endedLives: result.endedLives,
        totalLive: result.totalLive,
      });
    } catch (error) {
      logger.error('Error refreshing Twitch', error);
    }
  }

  async refreshTrump(): Promise<void> {
    try {
      await trumpService.fetchTrumpTweets(20);
    } catch (error) {
      logger.error('Error refreshing Trump', error);
    }
  }

  calculateRelevanceScore(item: any, type: string): number {
    const now = new Date();
    let ageHours = 0;
    let maxAge: number = RELEVANCE.MAX_AGE_DEFAULT_HOURS;

    if (item.fetchedAt) {
      ageHours = (now.getTime() - new Date(item.fetchedAt).getTime()) / (1000 * 60 * 60);
    } else if (item.createdAt) {
      ageHours = (now.getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    }

    switch (type) {
      case 'video':
        maxAge = RELEVANCE.MAX_AGE_VIDEO_HOURS as number;
        break;
      case 'news':
        maxAge = RELEVANCE.MAX_AGE_NEWS_HOURS as number;
        break;
      case 'stream':
        maxAge = RELEVANCE.MAX_AGE_STREAM_HOURS as number;
        break;
      case 'trump':
        maxAge = RELEVANCE.MAX_AGE_TRUMP_HOURS as number;
        break;
      default:
        maxAge = RELEVANCE.MAX_AGE_DEFAULT_HOURS as number;
    }

    const recencyScore = Math.max(0, 1 - ageHours / maxAge);

    let engagementScore = 0;
    if (item.likes) engagementScore += Math.log10(item.likes + 1) / 10;
    if (item.retweets) engagementScore += Math.log10(item.retweets + 1) / 10;
    if (item.views) engagementScore += Math.log10(item.views + 1) / 10;
    if (item.viewerCount) engagementScore += Math.log10(item.viewerCount + 1) / 10;

    const score = RELEVANCE.RECENCY_WEIGHT * recencyScore + RELEVANCE.ENGAGEMENT_WEIGHT * engagementScore + RELEVANCE.BASE_SCORE;

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
      onProgress?.('Loading streams, videos, news...');

      const [weather, streams, videos, news, trump, youtubeLives, market] = await Promise.allSettled([
        weatherService.getWeeklyForecast(weatherCity),
        twitchService.getLiveStreamsFast(20),
        youtubeService.getLatestVideos(20),
        newsService.getCachedNews(20),
        trumpService.getCachedTrumpTweets(20),
        youtubeService.getCachedLiveStreams(10),
        marketService.getLiveMarketData(),
      ]);

      onProgress?.('Done');

      const weatherData = weather.status === 'fulfilled' ? weather.value : null;
      const twitchStreams = streams.status === 'fulfilled' && Array.isArray(streams.value) ? streams.value : [];
      const videoData = videos.status === 'fulfilled' && Array.isArray(videos.value) ? videos.value : [];
      const newsData = news.status === 'fulfilled' && Array.isArray(news.value) ? news.value : [];
      const youtubeLiveData = youtubeLives.status === 'fulfilled' && Array.isArray(youtubeLives.value) ? youtubeLives.value : [];
      const marketData = market.status === 'fulfilled' && Array.isArray(market.value) ? market.value : [];

      // Filter trump tweets by min criticality preference
      let trumpData = trump.status === 'fulfilled' && Array.isArray(trump.value) ? trump.value : [];
      if (trumpMinCriticality > 0) {
        trumpData = trumpData.filter((t: any) => t.criticality >= trumpMinCriticality);
      }

      // Merge YouTube live streams into Twitch streams
      const mergedStreams = [
        ...twitchStreams,
        ...youtubeLiveData.map((v: any) => ({
          id: v.youtubeId || v.id,
          twitchId: v.youtubeId || v.id,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          viewerCount: v.views || 0,
          channelName: v.channelName,
          channelAvatar: v.channelAvatar,
          gameName: 'YouTube Live',
          isLive: true,
          url: v.url,
        })),
      ];

      return {
        weather: weatherData,
        market: marketData,
        streams: mergedStreams,
        videos: this.sortByRelevance(videoData, 'video'),
        news: newsData,
        trump: trumpData,
        refreshedAt: new Date(),
      };
    } catch (error) {
      logger.error('Error getting dashboard data', error);
      return {
        weather: null,
        market: [],
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

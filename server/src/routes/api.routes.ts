import { Router, Request, Response } from 'express';
import { weatherService } from '../services/weather.service';
import { newsService } from '../services/news.service';
import { twitterService } from '../services/twitter.service';
import { youtubeService } from '../services/youtube.service';
import { twitchService } from '../services/twitch.service';
import { trumpService } from '../services/trump.service';
import { aggregatorService } from '../services/aggregator.service';

const router = Router();

const validateLimit = (limit: any): number => {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return 20;
  if (parsed > 100) return 100;
  return parsed;
};

const validateCity = (city: any): string => {
  if (typeof city !== 'string' || !/^[a-zA-Z0-9\s\-_À-ÿ]+$/.test(city)) {
    return 'Caen';
  }
  return city.substring(0, 50);
};

router.get('/tweets', async (req: Request, res: Response) => {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await twitterService.getTimeline(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
});

router.get('/trump', async (req: Request, res: Response) => {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await trumpService.getCachedTrumpTweets(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Trump tweets' });
  }
});

router.get('/streams', async (_req: Request, res: Response) => {
  try {
    const streams = await twitchService.getFollowedStreams();
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
});

router.get('/follows', async (req: Request, res: Response) => {
  try {
    const username = req.query.username as string;
    if (username) {
      const follows = await twitchService.getFollowsByProfile(username);
      res.json(follows);
    } else {
      const follows = await twitchService.getFollows();
      res.json(follows);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch follows' });
  }
});

// Twitch: Import follows from a pasted list
router.post('/twitch/import-list', async (req: Request, res: Response) => {
  try {
    const { channels } = req.body;
    if (!channels || !Array.isArray(channels)) {
      res.status(400).json({ error: 'channels array is required' });
      return;
    }
    const result = await twitchService.importFollowsFromList(channels);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to import channel list' });
  }
});

// YouTube: Import subscriptions from a pasted list of handles
router.post('/youtube/import-list', async (req: Request, res: Response) => {
  try {
    const { channels } = req.body;
    if (!channels || !Array.isArray(channels)) {
      res.status(400).json({ error: 'channels array is required' });
      return;
    }
    const cleaned = channels
      .map((c: string) => c.trim())
      .filter((c: string) => c.length > 0)
      .map((c: string) => c.startsWith('@') ? c : `@${c}`);

    const existing = await youtubeService.getChannelHandles();
    const merged = [...new Set([...existing, ...cleaned])];
    await youtubeService.saveChannelHandles(merged);

    res.json({ imported: cleaned.length, channels: merged });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import YouTube channels' });
  }
});

// YouTube: Import subscriptions from Google Takeout CSV (channel IDs)
router.post('/youtube/import-takeout', async (req: Request, res: Response) => {
  try {
    const { channels } = req.body;
    if (!Array.isArray(channels)) {
      res.status(400).json({ error: 'channels array is required' });
      return;
    }
    const valid = channels.filter((c: any) =>
      typeof c.channelId === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(c.channelId)
    );
    const existing = await youtubeService.getChannelIds();
    const newIds = valid.map((c: any) => c.channelId as string);
    const merged = [...new Set([...existing, ...newIds])];
    await youtubeService.saveChannelIds(merged);
    res.json({ imported: valid.length, total: merged.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import YouTube channels from Takeout' });
  }
});

router.get('/videos', async (_req: Request, res: Response) => {
  try {
    const videos = await youtubeService.getLatestVideos();
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.get('/news', async (req: Request, res: Response) => {
  try {
    const limit = validateLimit(req.query.limit);
    const news = await newsService.getCachedNews(limit);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

router.get('/weather', async (req: Request, res: Response) => {
  try {
    const city = validateCity(req.query.city);
    const forecast = await weatherService.getWeeklyForecast(city);
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

router.get('/dashboard/stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (data: any, event?: string) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const data = await aggregatorService.getDashboardData((step: string) => {
      sendEvent({ step }, 'progress');
    });
    sendEvent(data, 'dashboard');
  } catch (error) {
    sendEvent({ error: 'Failed to fetch dashboard data' }, 'error');
  }

  res.end();
});

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await aggregatorService.getDashboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

router.post('/refresh/all', async (_req: Request, res: Response) => {
  try {
    await aggregatorService.refreshAll();
    res.json({ success: true, message: 'Refresh initiated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh' });
  }
});

router.post('/refresh/news', async (_req: Request, res: Response) => {
  try {
    const news = await newsService.fetchAiNews();
    res.json({ success: true, count: news.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh news' });
  }
});

router.post('/refresh/twitch', async (_req: Request, res: Response) => {
  try {
    await aggregatorService.refreshTwitch();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh Twitch' });
  }
});

router.post('/refresh/trump', async (_req: Request, res: Response) => {
  try {
    const tweets = await trumpService.fetchTrumpTweets(20);
    res.json({ success: true, count: tweets.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh Trump tweets' });
  }
});

// Preferences CRUD
router.get('/preferences', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('../db/prisma.client');
    let pref = await prisma.userPreference.findFirst();
    if (!pref) {
      pref = await prisma.userPreference.create({ data: {} });
    }
    res.json({
      weatherCity: pref.weatherCity,
      twitchFollows: pref.twitchFollows,
      twitchUsername: pref.twitchUsername,
      youtubeChannels: pref.youtubeChannels,
      youtubeChannelIds: pref.youtubeChannelIds,
      twitterUsername: pref.twitterUsername,
      twitterAccounts: pref.twitterAccounts,
      trumpMinCriticality: pref.trumpMinCriticality,
      customRssFeeds: pref.customRssFeeds,
      refreshInterval: pref.refreshInterval,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

router.post('/preferences', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../db/prisma.client');
    const { weatherCity, twitchFollows, twitchUsername, youtubeChannels, youtubeChannelIds, twitterUsername, twitterAccounts, trumpMinCriticality, customRssFeeds, refreshInterval } = req.body;

    const data: Record<string, any> = {};
    if (typeof weatherCity === 'string') data.weatherCity = weatherCity.substring(0, 50);
    if (typeof twitchFollows === 'string') data.twitchFollows = twitchFollows.substring(0, 10000);
    if (typeof twitchUsername === 'string') data.twitchUsername = twitchUsername.substring(0, 50);
    if (typeof youtubeChannels === 'string') data.youtubeChannels = youtubeChannels.substring(0, 10000);
    if (typeof youtubeChannelIds === 'string') data.youtubeChannelIds = youtubeChannelIds.substring(0, 50000);
    if (typeof twitterUsername === 'string') data.twitterUsername = twitterUsername.substring(0, 100);
    if (typeof twitterAccounts === 'string') data.twitterAccounts = twitterAccounts.substring(0, 50000);
    if (typeof trumpMinCriticality === 'number') data.trumpMinCriticality = Math.max(0, Math.min(10, trumpMinCriticality));
    if (typeof customRssFeeds === 'string') data.customRssFeeds = customRssFeeds.substring(0, 10000);
    if (typeof refreshInterval === 'number') data.refreshInterval = Math.max(5, Math.min(60, refreshInterval));

    const existing = await prisma.userPreference.findFirst();
    if (existing) {
      await prisma.userPreference.update({ where: { id: existing.id }, data });
    } else {
      await prisma.userPreference.create({ data });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

export default router;

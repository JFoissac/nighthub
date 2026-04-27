import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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

/** Zod body validation middleware */
function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
      return;
    }
    (req as any).validatedBody = parsed.data as z.infer<T>;
    next();
  };
}

// --- Zod schemas for POST routes ---
// Scopes are structural only; clamping / truncation stays in handlers to preserve existing behaviour.
const twitchImportSchema = z.object({ channels: z.array(z.string()) });
const youtubeImportListSchema = z.object({ channels: z.array(z.string()) });
const youtubeImportTakeoutSchema = z.object({ channels: z.array(z.object({ channelId: z.string() })) });
const detectFeedSchema = z.object({ url: z.string().startsWith('http') });
const preferencesSchema = z.object({
  weatherCity: z.string().optional(),
  twitchFollows: z.string().optional(),
  twitchUsername: z.string().optional(),
  youtubeChannels: z.string().optional(),
  youtubeChannelIds: z.string().optional(),
  twitterUsername: z.string().optional(),
  twitterAccounts: z.string().optional(),
  trumpMinCriticality: z.number().optional(),
  customRssFeeds: z.string().optional(),
  refreshInterval: z.number().optional(),
});

// --- Route handlers ---

async function getTweets(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await twitterService.getTimeline(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
}

async function getTrump(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await trumpService.getCachedTrumpTweets(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Trump tweets' });
  }
}

async function getStreams(_req: Request, res: Response) {
  try {
    const streams = await twitchService.getFollowedStreams();
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
}

async function getFollows(req: Request, res: Response) {
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
}

async function importTwitchList(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof twitchImportSchema>;
    const result = await twitchService.importFollowsFromList(channels);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to import channel list' });
  }
}

async function importYoutubeList(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof youtubeImportListSchema>;
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
}

async function importYoutubeTakeout(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof youtubeImportTakeoutSchema>;
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
}

async function getVideos(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const videos = await youtubeService.getLatestVideos(limit);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}

async function getNews(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const news = await newsService.getCachedNews(limit);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}

async function getWeather(req: Request, res: Response) {
  try {
    const city = validateCity(req.query.city);
    const forecast = await weatherService.getWeeklyForecast(city);
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
}

async function getDashboardStream(_req: Request, res: Response) {
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
}

async function getDashboard(_req: Request, res: Response) {
  try {
    const data = await aggregatorService.getDashboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

async function refreshAll(_req: Request, res: Response) {
  try {
    await aggregatorService.refreshAll();
    res.json({ success: true, message: 'Refresh initiated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh' });
  }
}

async function refreshNews(_req: Request, res: Response) {
  try {
    const news = await newsService.fetchAiNews();
    res.json({ success: true, count: news.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh news' });
  }
}

async function refreshTwitch(_req: Request, res: Response) {
  try {
    await aggregatorService.refreshTwitch();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh Twitch' });
  }
}

async function refreshTrump(_req: Request, res: Response) {
  try {
    const tweets = await trumpService.fetchTrumpTweets(20);
    res.json({ success: true, count: tweets.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh Trump tweets' });
  }
}

async function detectFeed(req: Request, res: Response) {
  try {
    const { url } = (req as any).validatedBody as z.infer<typeof detectFeedSchema>;
    const feedUrl = await newsService.detectFeed(url);
    if (!feedUrl) {
      res.status(404).json({ error: 'No RSS feed found' });
      return;
    }
    res.json({ feedUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect feed' });
  }
}

async function getTwitterAccountStats(_req: Request, res: Response) {
  try {
    const { prisma } = await import('../db/prisma.client');
    const accounts = await twitterService.getTwitterAccounts();
    const stats = await prisma.$queryRaw<{ authorHandle: string; lastSeen: string }[]>`
      SELECT authorHandle, MAX(fetchedAt) as lastSeen FROM Tweet GROUP BY authorHandle
    `;
    const statsMap = new Map(stats.map(s => [
      s.authorHandle.replace('@', '').toLowerCase(),
      new Date(s.lastSeen),
    ]));
    const result = accounts.map(handle => {
      const d = statsMap.get(handle.toLowerCase());
      return {
        handle,
        lastSeen: d ? d.toISOString() : null,
        inactive: !d || (Date.now() - d.getTime()) > 7 * 24 * 60 * 60 * 1000,
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account stats' });
  }
}

async function getPreferences(_req: Request, res: Response) {
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
}

async function savePreferences(req: Request, res: Response) {
  try {
    const { prisma } = await import('../db/prisma.client');
    const body = (req as any).validatedBody as z.infer<typeof preferencesSchema>;

    const data: Record<string, any> = {};
    let handledYoutubeChannels = false;

    if (typeof body.weatherCity === 'string') data.weatherCity = body.weatherCity.substring(0, 50);
    if (typeof body.twitchFollows === 'string') data.twitchFollows = body.twitchFollows.substring(0, 10000);
    if (typeof body.twitchUsername === 'string') data.twitchUsername = body.twitchUsername.substring(0, 50);
    if (typeof body.youtubeChannels === 'string') {
      const handles = body.youtubeChannels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await youtubeService.saveChannelHandles(handles);
      handledYoutubeChannels = true;
    }
    if (typeof body.youtubeChannelIds === 'string' && !handledYoutubeChannels) {
      data.youtubeChannelIds = body.youtubeChannelIds.substring(0, 50000);
    }
    if (typeof body.twitterUsername === 'string') data.twitterUsername = body.twitterUsername.substring(0, 100);
    if (typeof body.twitterAccounts === 'string') data.twitterAccounts = body.twitterAccounts.substring(0, 50000);
    if (typeof body.trumpMinCriticality === 'number') data.trumpMinCriticality = Math.max(0, Math.min(10, body.trumpMinCriticality));
    if (typeof body.customRssFeeds === 'string') data.customRssFeeds = body.customRssFeeds.substring(0, 10000);
    if (typeof body.refreshInterval === 'number') data.refreshInterval = Math.max(5, Math.min(60, body.refreshInterval));

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
}

// --- Routes ---

router.get('/tweets', getTweets);
router.get('/trump', getTrump);
router.get('/streams', getStreams);
router.get('/follows', getFollows);

router.post('/twitch/import-list', validateBody(twitchImportSchema), importTwitchList);
router.post('/youtube/import-list', validateBody(youtubeImportListSchema), importYoutubeList);
router.post('/youtube/import-takeout', validateBody(youtubeImportTakeoutSchema), importYoutubeTakeout);

router.get('/videos', getVideos);
router.get('/news', getNews);
router.get('/weather', getWeather);

router.get('/dashboard/stream', getDashboardStream);
router.get('/dashboard', getDashboard);

router.post('/refresh/all', refreshAll);
router.post('/refresh/news', refreshNews);
router.post('/refresh/twitch', refreshTwitch);
router.post('/refresh/trump', refreshTrump);

router.post('/sites/detect-feed', validateBody(detectFeedSchema), detectFeed);

router.get('/twitter/account-stats', getTwitterAccountStats);

router.get('/preferences', getPreferences);
router.post('/preferences', validateBody(preferencesSchema), savePreferences);

export default router;

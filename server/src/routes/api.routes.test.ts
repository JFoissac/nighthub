import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}));

vi.mock('rss-parser', () => ({
  default: function () {
    return { parseURL: vi.fn().mockResolvedValue({ items: [] }) };
  } as any,
}));

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/weather.service', () => ({
  weatherService: {
    getWeeklyForecast: vi.fn(),
  },
}));

vi.mock('../services/news.service', () => ({
  newsService: {
    fetchAiNews: vi.fn(),
    getCachedNews: vi.fn(),
    detectFeed: vi.fn(),
    validateFeedUrl: vi.fn(),
  },
}));

vi.mock('../services/twitter.service', () => ({
  twitterService: {
    getTimeline: vi.fn(),
    getTwitterAccounts: vi.fn(),
  },
}));

vi.mock('../services/youtube.service', () => ({
  youtubeService: {
    getLatestVideos: vi.fn(),
    getChannelHandles: vi.fn().mockResolvedValue([]),
    getChannelIds: vi.fn().mockResolvedValue([]),
    saveChannelHandles: vi.fn(),
    saveChannelIds: vi.fn(),
  },
}));

vi.mock('../services/twitch.service', () => ({
  twitchService: {
    getFollowedStreams: vi.fn(),
    getFollows: vi.fn(),
    getFollowsByProfile: vi.fn(),
    importFollowsFromList: vi.fn(),
  },
}));

vi.mock('../services/trump.service', () => ({
  trumpService: {
    fetchTrumpTweets: vi.fn(),
    getCachedTrumpTweets: vi.fn(),
  },
}));

vi.mock('../services/aggregator.service', () => ({
  aggregatorService: {
    getDashboardData: vi.fn(),
    refreshAll: vi.fn(),
    refreshTwitch: vi.fn(),
  },
}));

import router from './api.routes';
import { weatherService } from '../services/weather.service';
import { newsService } from '../services/news.service';
import { twitterService } from '../services/twitter.service';
import { youtubeService } from '../services/youtube.service';
import { twitchService } from '../services/twitch.service';
import { trumpService } from '../services/trump.service';
import { aggregatorService } from '../services/aggregator.service';
import { prisma } from '../db/prisma.client';

function getHandler(path: string, method: string) {
  const layer = (router as any).stack.find(
    (l: any) => l.route && l.route.path === path && l.route.methods[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  const stack = layer.route.stack.map((s: any) => s.handle);
  return async (req: any, res: any) => {
    let index = 0;
    const next = (err?: any) => {
      if (err) throw err;
      index++;
    };
    while (index < stack.length) {
      const handle = stack[index];
      const result = handle(req, res, next);
      if (result instanceof Promise) {
        await result;
      }
      // Stop if a response was already sent (e.g. by validation middleware)
      if (
        res.json.mock?.calls?.length > 0 ||
        res.status.mock?.calls?.length > 0 ||
        res.writeHead.mock?.calls?.length > 0
      ) {
        break;
      }
      // If the handler didn't call next() (typical for final handlers), advance manually
      if (handle === stack[index]) {
        index++;
      }
    }
  };
}

function mockRes() {
  const jsonFn = vi.fn();
  const statusFn = vi.fn().mockReturnThis();
  return {
    json: jsonFn,
    status: statusFn,
    writeHead: vi.fn().mockReturnThis(),
    write: vi.fn(),
    end: vi.fn(),
  } as any;
}

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /weather', () => {
    it('returns weather for a valid city', async () => {
      const handler = getHandler('/weather', 'get');
      const res = mockRes();
      const req = { query: { city: 'Paris' } } as any;
      (weatherService.getWeeklyForecast as any).mockResolvedValue({ city: 'Paris' });

      await handler(req, res);
      expect(weatherService.getWeeklyForecast).toHaveBeenCalledWith('Paris');
      expect(res.json).toHaveBeenCalledWith({ city: 'Paris' });
    });

    it('falls back to Caen for invalid city', async () => {
      const handler = getHandler('/weather', 'get');
      const res = mockRes();
      const req = { query: { city: '123!!!' } } as any;
      (weatherService.getWeeklyForecast as any).mockResolvedValue({ city: 'Caen' });

      await handler(req, res);
      expect(weatherService.getWeeklyForecast).toHaveBeenCalledWith('Caen');
    });

    it('returns 500 on error', async () => {
      const handler = getHandler('/weather', 'get');
      const res = mockRes();
      const req = { query: {} } as any;
      (weatherService.getWeeklyForecast as any).mockRejectedValue(new Error('fail'));

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch weather' });
    });
  });

  describe('GET /news', () => {
    it('returns news with validated limit', async () => {
      const handler = getHandler('/news', 'get');
      const res = mockRes();
      const req = { query: { limit: '10' } } as any;
      (newsService.getCachedNews as any).mockResolvedValue([{ title: 'N1' }]);

      await handler(req, res);
      expect(newsService.getCachedNews).toHaveBeenCalledWith(10);
      expect(res.json).toHaveBeenCalledWith([{ title: 'N1' }]);
    });

    it('returns 500 on error', async () => {
      const handler = getHandler('/news', 'get');
      const res = mockRes();
      const req = { query: {} } as any;
      (newsService.getCachedNews as any).mockRejectedValue(new Error('fail'));

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /tweets', () => {
    it('returns tweets with limit', async () => {
      const handler = getHandler('/tweets', 'get');
      const res = mockRes();
      const req = { query: { limit: '5' } } as any;
      (twitterService.getTimeline as any).mockResolvedValue([{ id: 't1' }]);

      await handler(req, res);
      expect(twitterService.getTimeline).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith([{ id: 't1' }]);
    });
  });

  describe('GET /trump', () => {
    it('returns trump tweets with limit', async () => {
      const handler = getHandler('/trump', 'get');
      const res = mockRes();
      const req = { query: { limit: '15' } } as any;
      (trumpService.getCachedTrumpTweets as any).mockResolvedValue([{ content: 'T' }]);

      await handler(req, res);
      expect(trumpService.getCachedTrumpTweets).toHaveBeenCalledWith(15);
      expect(res.json).toHaveBeenCalledWith([{ content: 'T' }]);
    });
  });

  describe('GET /streams', () => {
    it('returns streams', async () => {
      const handler = getHandler('/streams', 'get');
      const res = mockRes();
      const req = {} as any;
      (twitchService.getFollowedStreams as any).mockResolvedValue([{ title: 'S1' }]);

      await handler(req, res);
      expect(twitchService.getFollowedStreams).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith([{ title: 'S1' }]);
    });
  });

  describe('GET /videos', () => {
    it('returns videos', async () => {
      const handler = getHandler('/videos', 'get');
      const res = mockRes();
      const req = { query: {} } as any;
      (youtubeService.getLatestVideos as any).mockResolvedValue([{ title: 'V1' }]);

      await handler(req, res);
      expect(youtubeService.getLatestVideos).toHaveBeenCalledWith(20);
      expect(res.json).toHaveBeenCalledWith([{ title: 'V1' }]);
    });
  });

  describe('GET /follows', () => {
    it('returns follows by profile when username is provided', async () => {
      const handler = getHandler('/follows', 'get');
      const res = mockRes();
      const req = { query: { username: 'shroud' } } as any;
      (twitchService.getFollowsByProfile as any).mockResolvedValue([{ channelName: 'Shroud' }]);

      await handler(req, res);
      expect(twitchService.getFollowsByProfile).toHaveBeenCalledWith('shroud');
      expect(res.json).toHaveBeenCalledWith([{ channelName: 'Shroud' }]);
    });

    it('returns all follows when no username', async () => {
      const handler = getHandler('/follows', 'get');
      const res = mockRes();
      const req = { query: {} } as any;
      (twitchService.getFollows as any).mockResolvedValue([{ channelName: 'All' }]);

      await handler(req, res);
      expect(twitchService.getFollows).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith([{ channelName: 'All' }]);
    });
  });

  describe('POST /twitch/import-list', () => {
    it('imports channels and returns result', async () => {
      const handler = getHandler('/twitch/import-list', 'post');
      const res = mockRes();
      const req = { body: { channels: ['shroud', 'ninja'] } } as any;
      (twitchService.importFollowsFromList as any).mockResolvedValue({ imported: 2, channels: ['shroud', 'ninja'], invalid: [] });

      await handler(req, res);
      expect(twitchService.importFollowsFromList).toHaveBeenCalledWith(['shroud', 'ninja']);
      expect(res.json).toHaveBeenCalledWith({ imported: 2, channels: ['shroud', 'ninja'], invalid: [] });
    });
  });

  describe('POST /youtube/import-list', () => {
    it('imports handles, merges with existing and saves', async () => {
      const handler = getHandler('/youtube/import-list', 'post');
      const res = mockRes();
      const req = { body: { channels: ['LinusTechTips', '@MKBHD'] } } as any;
      (youtubeService.getChannelHandles as any).mockResolvedValue(['@existing']);

      await handler(req, res);
      expect(youtubeService.saveChannelHandles).toHaveBeenCalledWith(['@existing', '@LinusTechTips', '@MKBHD']);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 2 }));
    });
  });

  describe('POST /youtube/import-takeout', () => {
    it('imports valid channel IDs and merges', async () => {
      const handler = getHandler('/youtube/import-takeout', 'post');
      const res = mockRes();
      const validId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
      const req = { body: { channels: [{ channelId: validId }, { channelId: 'bad' }] } } as any;
      (youtubeService.getChannelIds as any).mockResolvedValue(['UCexisting1111111111111']);

      await handler(req, res);
      expect(youtubeService.saveChannelIds).toHaveBeenCalledWith(['UCexisting1111111111111', validId]);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ imported: 1 }));
    });
  });

  describe('GET /dashboard', () => {
    it('returns dashboard data', async () => {
      const handler = getHandler('/dashboard', 'get');
      const res = mockRes();
      const req = {} as any;
      const data = { weather: null, tweets: [], streams: [], videos: [], news: [], trump: [], refreshedAt: new Date() };
      (aggregatorService.getDashboardData as any).mockResolvedValue(data);

      await handler(req, res);
      expect(aggregatorService.getDashboardData).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(data);
    });

    it('returns 500 on error', async () => {
      const handler = getHandler('/dashboard', 'get');
      const res = mockRes();
      const req = {} as any;
      (aggregatorService.getDashboardData as any).mockRejectedValue(new Error('fail'));

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /dashboard/stream', () => {
    it('streams progress events and final dashboard', async () => {
      const handler = getHandler('/dashboard/stream', 'get');
      const res = mockRes();
      const req = {} as any;
      (aggregatorService.getDashboardData as any).mockImplementation(async (onProgress?: (step: string) => void) => {
        onProgress?.('step1');
        return { weather: null };
      });

      await handler(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.write).toHaveBeenCalledWith('event: progress\n');
      expect(res.write).toHaveBeenCalledWith('data: {"step":"step1"}\n\n');
      expect(res.write).toHaveBeenCalledWith('event: dashboard\n');
      expect(res.write).toHaveBeenCalledWith('data: {"weather":null}\n\n');
      expect(res.end).toHaveBeenCalled();
    });

    it('streams error event on failure', async () => {
      const handler = getHandler('/dashboard/stream', 'get');
      const res = mockRes();
      const req = {} as any;
      (aggregatorService.getDashboardData as any).mockRejectedValue(new Error('fail'));

      await handler(req, res);
      expect(res.write).toHaveBeenCalledWith('event: error\n');
      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch dashboard data'));
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('POST /refresh/all', () => {
    it('refreshes all and returns success', async () => {
      const handler = getHandler('/refresh/all', 'post');
      const res = mockRes();
      const req = {} as any;
      (aggregatorService.refreshAll as any).mockResolvedValue(undefined);

      await handler(req, res);
      expect(aggregatorService.refreshAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Refresh initiated' });
    });
  });

  describe('POST /refresh/news', () => {
    it('refreshes news and returns count', async () => {
      const handler = getHandler('/refresh/news', 'post');
      const res = mockRes();
      const req = {} as any;
      (newsService.fetchAiNews as any).mockResolvedValue([{ title: 'N1' }]);

      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 1 });
    });
  });

  describe('POST /refresh/twitch', () => {
    it('refreshes twitch and returns success', async () => {
      const handler = getHandler('/refresh/twitch', 'post');
      const res = mockRes();
      const req = {} as any;
      (aggregatorService.refreshTwitch as any).mockResolvedValue(undefined);

      await handler(req, res);
      expect(aggregatorService.refreshTwitch).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('POST /refresh/trump', () => {
    it('refreshes trump tweets and returns count', async () => {
      const handler = getHandler('/refresh/trump', 'post');
      const res = mockRes();
      const req = {} as any;
      (trumpService.fetchTrumpTweets as any).mockResolvedValue([{ content: 'T1' }]);

      await handler(req, res);
      expect(trumpService.fetchTrumpTweets).toHaveBeenCalledWith(20);
      expect(res.json).toHaveBeenCalledWith({ success: true, count: 1 });
    });
  });

  describe('POST /sites/detect-feed', () => {
    it('returns 404 when no feed found', async () => {
      const handler = getHandler('/sites/detect-feed', 'post');
      const res = mockRes();
      const req = { body: { url: 'https://example.com' } } as any;
      (newsService.detectFeed as any).mockResolvedValue(null);

      await handler(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No RSS feed found' });
    });

    it('returns feedUrl when found', async () => {
      const handler = getHandler('/sites/detect-feed', 'post');
      const res = mockRes();
      const req = { body: { url: 'https://example.com' } } as any;
      (newsService.detectFeed as any).mockResolvedValue('https://example.com/feed.xml');

      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith({ feedUrl: 'https://example.com/feed.xml' });
    });
  });

  describe('GET /twitter/account-stats', () => {
    it('returns stats for accounts', async () => {
      const handler = getHandler('/twitter/account-stats', 'get');
      const res = mockRes();
      const req = {} as any;
      (twitterService.getTwitterAccounts as any).mockResolvedValue(['elonmusk', 'jack']);
      (prisma.$queryRaw as any).mockResolvedValue([
        { authorHandle: '@elonmusk', lastSeen: new Date().toISOString() },
      ]);

      await handler(req, res);
      const result = res.json.mock.calls[0][0];
      expect(result).toHaveLength(2);
      expect(result[0].handle).toBe('elonmusk');
      expect(result[0].inactive).toBe(false);
      expect(result[1].inactive).toBe(true);
    });
  });

  describe('GET /preferences', () => {
    it('returns existing preferences', async () => {
      const handler = getHandler('/preferences', 'get');
      const res = mockRes();
      const req = {} as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue({
        weatherCity: 'Paris',
        twitchFollows: '',
        twitchUsername: '',
        youtubeChannels: '',
        youtubeChannelIds: '',
        twitterUsername: '',
        twitterAccounts: '',
        trumpMinCriticality: 3,
        customRssFeeds: '',
        refreshInterval: 30,
      });

      await handler(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ weatherCity: 'Paris', trumpMinCriticality: 3 }));
    });

    it('creates default preferences if none exist', async () => {
      const handler = getHandler('/preferences', 'get');
      const res = mockRes();
      const req = {} as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);
      (prisma.userPreference.create as any).mockResolvedValue({ weatherCity: 'Caen', trumpMinCriticality: 0 });

      await handler(req, res);
      expect(prisma.userPreference.create).toHaveBeenCalled();
    });
  });

  describe('POST /preferences', () => {
    it('updates existing preferences', async () => {
      const handler = getHandler('/preferences', 'post');
      const res = mockRes();
      const req = { body: { weatherCity: 'Lyon', trumpMinCriticality: 7 } } as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: 'pref1' });

      await handler(req, res);
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref1' },
          data: expect.objectContaining({ weatherCity: 'Lyon', trumpMinCriticality: 7 }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('clamps trumpMinCriticality between 0 and 10', async () => {
      const handler = getHandler('/preferences', 'post');
      const res = mockRes();
      const req = { body: { trumpMinCriticality: 15 } } as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: 'pref1' });

      await handler(req, res);
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ trumpMinCriticality: 10 }),
        })
      );
    });

    it('creates preferences if none exist', async () => {
      const handler = getHandler('/preferences', 'post');
      const res = mockRes();
      const req = { body: { weatherCity: 'Nice' } } as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);

      await handler(req, res);
      expect(prisma.userPreference.create).toHaveBeenCalled();
    });

    it('reconciles youtube channel IDs when youtubeChannels is provided', async () => {
      const handler = getHandler('/preferences', 'post');
      const res = mockRes();
      const req = { body: { youtubeChannels: '@foo,@bar', youtubeChannelIds: 'UCstale' } } as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: 'pref1' });

      await handler(req, res);

      expect(youtubeService.saveChannelHandles).toHaveBeenCalledWith(['@foo', '@bar']);
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref1' },
          data: expect.not.objectContaining({ youtubeChannelIds: expect.any(String) }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('keeps direct youtubeChannelIds update when youtubeChannels is absent', async () => {
      const handler = getHandler('/preferences', 'post');
      const res = mockRes();
      const req = { body: { youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' } } as any;
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: 'pref1' });

      await handler(req, res);

      expect(youtubeService.saveChannelHandles).not.toHaveBeenCalled();
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref1' },
          data: expect.objectContaining({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' }),
        })
      );
    });
  });
});

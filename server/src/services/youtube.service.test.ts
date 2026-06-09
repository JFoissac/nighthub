import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    youtubeVideo: {
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../config/env', () => ({
  config: {
    port: 3000,
    nodeEnv: 'test',
    youtube: { clientId: '', clientSecret: '', redirectUri: '' },
    twitch: { clientId: '', clientSecret: '', redirectUri: '' },
    openWeatherMap: { apiKey: '' },
    piped: { instanceUrl: 'https://pipedapi.test.local' },
    database: { url: 'file:./dev.db' },
  },
}));

vi.mock('rss-parser', () => ({
  default: function() {
    return {
      parseURL: vi.fn().mockResolvedValue({
        title: 'Test Channel',
        items: [
          {
            id: 'yt:video:abc123',
            title: 'Test Video',
            pubDate: new Date().toISOString(),
            link: 'https://www.youtube.com/watch?v=abc123',
            mediaGroup: {
              'media:community': {
                'media:statistics': { $: { views: '1000' } },
              },
            },
          },
        ],
      }),
    };
  } as any,
}));

import { YoutubeService } from './youtube.service';

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(() => {
    service = new YoutubeService();
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  describe('getChannelHandles', () => {
    it('parses comma-separated handles from preferences', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ youtubeChannels: '@foo, @bar ,baz' });
      const handles = await service.getChannelHandles();
      expect(handles).toEqual(['@foo', '@bar', 'baz']);
    });

    it('returns empty array when no preferences exist', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);
      expect(await service.getChannelHandles()).toEqual([]);
    });

    it('returns empty array on error', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockRejectedValue(new Error('db error'));
      expect(await service.getChannelHandles()).toEqual([]);
    });
  });

  describe('saveChannelHandles', () => {
    it('updates existing preference', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: '1' });
      vi.spyOn(service, 'resolveChannelId').mockResolvedValue('UCbbbbbbbbbbbbbbbbbbbbbb');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      await service.saveChannelHandles(['@foo', '@bar']);
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { youtubeChannels: '@foo,@bar' } })
      );
    });

    it('creates preference if none exists', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue(null);
      vi.spyOn(service, 'resolveChannelId').mockResolvedValue('UCbbbbbbbbbbbbbbbbbbbbbb');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      await service.saveChannelHandles(['@foo']);
      expect(prisma.userPreference.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { youtubeChannels: '@foo' } })
      );
    });
  });

  describe('resolveChannelId', () => {
    it('returns input as-is when channel ID is already provided', async () => {
      expect(await service.resolveChannelId('UC1234567890123456789012')).toBe('UC1234567890123456789012');
    });

    it('extracts channelId from strict canonical+browseId HTML match', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(
          `some html "canonicalBaseUrl":"/@SylvainLyve" ... window['ytCommand'] = {"browseEndpoint":{"browseId":"UCB9gfNOymNLIm5J8lf4MhtA"}}; more html`
        ),
      });
      const id = await service.resolveChannelId('@SylvainLyve');
      expect(id).toBe('UCB9gfNOymNLIm5J8lf4MhtA');
    });

    it('does not use unrelated first channelId fallback (historical inversion case)', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(
          `prefix "channelId":"UCd26XTdCltsEpyvZmmGW9Aw" "canonicalBaseUrl":"/@SylvainLyve" middle "externalId":"UCB9gfNOymNLIm5J8lf4MhtA" suffix`
        ),
      });
      const id = await service.resolveChannelId('@SylvainLyve');
      expect(id).toBe('UCB9gfNOymNLIm5J8lf4MhtA');
    });

    it('returns null when canonical handle does not match requested handle', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(
          `"canonicalBaseUrl":"/@SomeoneElse" "externalId":"UCB9gfNOymNLIm5J8lf4MhtA"`
        ),
      });
      const id = await service.resolveChannelId('@SylvainLyve');
      expect(id).toBeNull();
    });

    it('returns null when fetch fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('network'));
      expect(await service.resolveChannelId('test')).toBeNull();
    });

    it('returns null when no match found', async () => {
      (global.fetch as any).mockResolvedValue({ ok: true, text: () => Promise.resolve('no id here') });
      expect(await service.resolveChannelId('test')).toBeNull();
    });
  });

  describe('getChannelIds', () => {
    it('returns validated channel IDs from preferences', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({
        youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb,invalid,UCcccccccccccccccccccccc',
      });
      const ids = await service.getChannelIds();
      expect(ids).toHaveLength(2);
      expect(ids.every((id: string) => /^UC[a-zA-Z0-9_-]{22}$/.test(id))).toBe(true);
    });

    it('returns empty array when field is missing', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({});
      expect(await service.getChannelIds()).toEqual([]);
    });
  });

  describe('saveChannelIds', () => {
    it('filters invalid IDs before saving', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: '1' });
      await service.saveChannelIds(['UCbbbbbbbbbbbbbbbbbbbbbb', 'bad', 'UCcccccccccccccccccccccc']);
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb,UCcccccccccccccccccccccc',
          }),
        })
      );
    });
  });

  describe('getCachedVideos', () => {
    it('queries videos by channelId within 7 days', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValueOnce({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' });

      await service.getCachedVideos();
      expect(prisma.youtubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishedAt: expect.objectContaining({ gte: expect.any(Date) }),
            channelId: { in: ['UCbbbbbbbbbbbbbbbbbbbbbb'] },
          }),
          take: 20,
          orderBy: { publishedAt: 'desc' },
        })
      );
    });

    it('returns empty array when no channels configured', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({});
      expect(await service.getCachedVideos()).toEqual([]);
    });
  });

  describe('getCachedLiveStreams', () => {
    it('syncs live cache before querying live streams', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      vi.spyOn(service, 'verifyAndCleanLiveStreams').mockResolvedValue();

      (prisma.userPreference.findFirst as any)
        .mockResolvedValueOnce({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' })
        .mockResolvedValueOnce({ youtubeChannels: '@foo' });
      (prisma.youtubeVideo.findMany as any).mockResolvedValueOnce([{ youtubeId: 'live1' }]);

      const lives = await service.getCachedLiveStreams(10);

      expect(service.fetchAndCacheLatestVideos).toHaveBeenCalledTimes(1);
      expect(service.verifyAndCleanLiveStreams).toHaveBeenCalledTimes(1);
      expect(lives).toEqual([{ youtubeId: 'live1', channelHandle: '' }]);
      expect(prisma.youtubeVideo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isLive: true }),
          take: 10,
        })
      );
    });

    it('uses TTL to avoid re-syncing on immediate subsequent calls', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      vi.spyOn(service, 'verifyAndCleanLiveStreams').mockResolvedValue();

      (prisma.userPreference.findFirst as any)
        .mockResolvedValue({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb', youtubeChannels: '@foo' });
      (prisma.youtubeVideo.findMany as any)
        .mockResolvedValueOnce([{ youtubeId: 'live1' }])
        .mockResolvedValueOnce([{ youtubeId: 'live1' }]);

      await service.getCachedLiveStreams(10);
      await service.getCachedLiveStreams(10);

      expect(service.fetchAndCacheLatestVideos).toHaveBeenCalledTimes(1);
      expect(service.verifyAndCleanLiveStreams).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLatestVideos', () => {
    it('returns cached videos without blocking on empty cache', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      (prisma.youtubeVideo.findMany as any).mockResolvedValue([]);
      (prisma.userPreference.findFirst as any).mockResolvedValue({});
      const videos = await service.getLatestVideos();
      expect(videos).toEqual([]);
      // background fetch triggered via setImmediate — no await here
    });

    it('returns cached videos directly when available', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      const fake = [{ youtubeId: 'v1', title: 'Cached' }];
      (prisma.youtubeVideo.findMany as any).mockReset();
      (prisma.youtubeVideo.findMany as any).mockResolvedValue(fake);
      (prisma.userPreference.findFirst as any)
        .mockResolvedValueOnce({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' })
        .mockResolvedValueOnce({ youtubeChannels: '@foo' });
      expect(await service.getLatestVideos()).toEqual([{ ...fake[0], channelHandle: '' }]);
    });
  });

  describe('fetchAndCacheLatestVideos', () => {
    it('returns early when no channels are configured', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({});

      // @ts-ignore — private method
      await service.fetchAndCacheLatestVideos();

      expect(prisma.youtubeVideo.upsert).not.toHaveBeenCalled();
    });

    it('reconciles channelIds from handles and purges orphan videos before cache refresh', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: '1', youtubeChannels: '@foo' });
      (prisma.youtubeVideo.findMany as any).mockResolvedValue([]);
      vi.spyOn(service, 'getChannelHandles').mockResolvedValue(['@foo']);
      vi.spyOn(service, 'resolveChannelId').mockResolvedValue('UCbbbbbbbbbbbbbbbbbbbbbb');

      await service.fetchAndCacheLatestVideos();

      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ youtubeChannelIds: 'UCbbbbbbbbbbbbbbbbbbbbbb' }),
        })
      );
      expect(prisma.youtubeVideo.deleteMany).toHaveBeenCalledWith({
        where: { channelId: { notIn: ['UCbbbbbbbbbbbbbbbbbbbbbb'] } },
      });
    });

    it('keeps stored channel IDs when handle resolution temporarily fails', async () => {
      const { prisma } = await import('../db/prisma.client');
      const storedId = 'UCaaaaaaaaaaaaaaaaaaaaaa';
      vi.spyOn(service, 'getChannelHandles').mockResolvedValue(['@foo']);
      vi.spyOn(service, 'getChannelIds').mockResolvedValue([storedId]);
      vi.spyOn(service, 'resolveChannelId').mockResolvedValue(null);

      await service.fetchAndCacheLatestVideos();

      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ youtubeChannelIds: storedId }),
        })
      );
      expect(prisma.youtubeVideo.deleteMany).toHaveBeenCalledWith({
        where: { channelId: { notIn: [storedId] } },
      });
    });
  });

  describe('remap diagnostics', () => {
    it('flags unresolved handles and orphan stored IDs', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'getChannelHandles').mockResolvedValue(['@good', '@bad']);
      vi.spyOn(service, 'getChannelIds').mockResolvedValue([
        'UCgoodgoodgoodgoodgoodgo',
        'UCorphanorphanorphanorph',
      ]);
      vi.spyOn(service, 'resolveChannelId')
        .mockImplementation(async (handle: string) => (
          handle === '@good' ? 'UCgoodgoodgoodgoodgoodgo' : null
        ));
      (prisma.youtubeVideo.findMany as any).mockResolvedValue([
        {
          channelId: 'UCgoodgoodgoodgoodgoodgo',
          channelName: 'Good Channel',
          channelHandle: '@good',
        },
        {
          channelId: 'UCorphanorphanorphanorph',
          channelName: 'Wrong Channel',
          channelHandle: '@wrong',
        },
      ]);

      const report = await service.getRemapReport();

      expect(report.handles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            handle: '@good',
            status: 'ok',
            resolvedChannelId: 'UCgoodgoodgoodgoodgoodgo',
          }),
          expect.objectContaining({
            handle: '@bad',
            status: 'unresolved',
            resolvedChannelId: null,
          }),
        ])
      );
      expect(report.orphanChannelIds).toEqual([
        expect.objectContaining({ channelId: 'UCorphanorphanorphanorph' }),
      ]);
    });
  });

  describe('manual remap', () => {
    it('applies explicit handle -> channel ID override and saves reconciled IDs', async () => {
      const { prisma } = await import('../db/prisma.client');
      vi.spyOn(service, 'getChannelHandles').mockResolvedValue(['@good', '@target']);
      vi.spyOn(service, 'resolveChannelId')
        .mockImplementation(async (handle: string) => (
          handle === '@good' ? 'UCgoodgoodgoodgoodgoodgo' : null
        ));
      const saveChannelIdsSpy = vi.spyOn(service, 'saveChannelIds').mockResolvedValue();
      vi.spyOn(service, 'fetchAndCacheLatestVideos').mockResolvedValue();
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: 'pref-1' });

      const result = await service.remapHandleToChannelId('@target', 'UCtargettargettargettarg');

      expect(result).toEqual({ handle: '@target', channelId: 'UCtargettargettargettarg' });
      expect(saveChannelIdsSpy).toHaveBeenCalledWith([
        'UCgoodgoodgoodgoodgoodgo',
        'UCtargettargettargettarg',
      ]);
      expect(prisma.youtubeVideo.deleteMany).toHaveBeenCalledWith({
        where: { channelId: { notIn: ['UCgoodgoodgoodgoodgoodgo', 'UCtargettargettargettarg'] } },
      });
    });
  });

  describe('duration helpers', () => {
    it('parseDurationSeconds converts ISO 8601 to seconds', () => {
      // @ts-ignore
      expect(service.parseDurationSeconds('PT1H2M3S')).toBe(3723);
      // @ts-ignore
      expect(service.parseDurationSeconds('PT5M')).toBe(300);
      // @ts-ignore
      expect(service.parseDurationSeconds('')).toBe(0);
    });

    it('formatDuration formats correctly', () => {
      // @ts-ignore
      expect(service.formatDuration('PT2M30S')).toBe('2:30');
      // @ts-ignore
      expect(service.formatDuration('PT1H5M3S')).toBe('1:05:03');
      // @ts-ignore
      expect(service.formatDuration('')).toBe('');
    });
  });

  describe('isShort', () => {
    it('detects #shorts in title', () => {
      // @ts-ignore
      expect(service.isShort({ title: 'Cool #shorts', url: '', durationSeconds: 120 })).toBe(true);
    });

    it('detects /shorts/ in URL', () => {
      // @ts-ignore
      expect(service.isShort({ title: 'Normal', url: 'https://youtube.com/shorts/abc', durationSeconds: 120 })).toBe(true);
    });

    it('detects duration under 60s', () => {
      // @ts-ignore
      expect(service.isShort({ title: 'Normal', url: '', durationSeconds: 45 })).toBe(true);
    });

    it('returns false for regular video', () => {
      // @ts-ignore
      expect(service.isShort({ title: 'Normal', url: 'https://youtube.com/watch?v=abc', durationSeconds: 300 })).toBe(false);
    });
  });

  describe('isRecent', () => {
    it('returns true for recent videos', () => {
      const recent = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
      // @ts-ignore
      expect(service.isRecent(recent)).toBe(true);
    });

    it('returns false for old videos', () => {
      const old = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
      // @ts-ignore
      expect(service.isRecent(old)).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('clears channel handles', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.userPreference.findFirst as any).mockResolvedValue({ id: '1' });
      await service.disconnect();
      expect(prisma.userPreference.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { youtubeChannels: '' } })
      );
    });
  });

  describe('secondsToIsoDuration', () => {
    it('converts seconds to ISO 8601 duration', () => {
      // @ts-ignore
      expect(service.secondsToIsoDuration(45)).toBe('PT45S');
      // @ts-ignore
      expect(service.secondsToIsoDuration(150)).toBe('PT2M30S');
      // @ts-ignore
      expect(service.secondsToIsoDuration(3661)).toBe('PT1H1M1S');
      // @ts-ignore
      expect(service.secondsToIsoDuration(0)).toBe('');
      // @ts-ignore
      expect(service.secondsToIsoDuration(-1)).toBe('');
    });
  });

  describe('fetchPipedDurations', () => {
    it('fetches durations from Piped API', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ duration: 212 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ duration: 45 }),
        });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const result = await service.fetchPipedDurations(['vid1', 'vid2']);

      expect(result.size).toBe(2);
      expect(result.get('vid1')).toBe('PT3M32S');
      expect(result.get('vid2')).toBe('PT45S');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://pipedapi.test.local/streams/vid1',
        expect.objectContaining({ headers: expect.any(Object) })
      );
    });

    it('handles Piped errors gracefully', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockRejectedValueOnce(new Error('Network error'));
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const result = await service.fetchPipedDurations(['fail1', 'fail2']);

      expect(result.size).toBe(0);
    });
  });

  describe('fetchDurations fallback chain', () => {
    it('uses Piped when no YouTube API key is set', async () => {
      const oldKey = process.env.YOUTUBE_API_KEY;
      process.env.YOUTUBE_API_KEY = '';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ duration: 300 }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const result = await service.fetchDurations(['vid1']);

      expect(result.get('vid1')).toBe('PT5M');

      process.env.YOUTUBE_API_KEY = oldKey;
    });

    it('uses API v3 when key is available', async () => {
      const oldKey = process.env.YOUTUBE_API_KEY;
      process.env.YOUTUBE_API_KEY = 'test_api_key';

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [{ id: 'vid1', contentDetails: { duration: 'PT10M30S' } }],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const result = await service.fetchDurations(['vid1']);

      expect(result.get('vid1')).toBe('PT10M30S');

      process.env.YOUTUBE_API_KEY = oldKey;
    });
  });

  describe('isVideoCurrentlyLive fallback behavior', () => {
    it('does not treat archived livestreams as live when YouTube watch page has isLiveContent only', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ livestream: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html>{"isLiveContent":true,"isLiveNow":false}</html>',
        });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const live = await service.isVideoCurrentlyLive('vid1');
      expect(live).toBe(false);
    });

    it('prefers YouTube live-now signal when Piped reports false', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ livestream: false }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html>{"isLiveNow":true}</html>',
        });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const live = await service.isVideoCurrentlyLive('vid2');
      expect(live).toBe(true);
    });

    it('trusts YouTube watch page over stale Piped true', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ livestream: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => '<html>{"isLiveNow":false}</html>',
        });
      vi.stubGlobal('fetch', fetchMock);

      // @ts-ignore
      const live = await service.isVideoCurrentlyLive('vid3');
      expect(live).toBe(false);
    });
  });
});

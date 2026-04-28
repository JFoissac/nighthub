import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTwitchService } from './twitch.service';
import { prisma } from '../db/prisma.client';

vi.mock('../db/prisma.client', () => ({
  prisma: {
    userPreference: {
      findFirst: vi.fn(),
    },
    twitchStream: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

describe('TwitchService.refreshLiveCacheLight', () => {
  let service: ReturnType<typeof createTwitchService>;
  const originalFetch = (globalThis as any).fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createTwitchService();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('refreshes cache timestamp when there are no live changes', async () => {
    (prisma.userPreference.findFirst as any).mockResolvedValue({ twitchFollows: 'foo,bar' });
    (prisma.twitchStream.findMany as any).mockResolvedValue([
      { id: '1', url: 'https://twitch.tv/foo' },
      { id: '2', url: 'https://twitch.tv/bar' },
    ]);

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          users: [
            {
              login: 'foo',
              displayName: 'Foo',
              profileImageURL: '',
              stream: {
                id: 'live-foo',
                title: 'foo live',
                viewersCount: 10,
                previewImageURL: '',
                game: { name: 'GameA' },
                createdAt: new Date().toISOString(),
              },
            },
            {
              login: 'bar',
              displayName: 'Bar',
              profileImageURL: '',
              stream: {
                id: 'live-bar',
                title: 'bar live',
                viewersCount: 8,
                previewImageURL: '',
                game: { name: 'GameB' },
                createdAt: new Date().toISOString(),
              },
            },
          ],
        },
      }),
    });

    const result = await service.refreshLiveCacheLight();

    expect(result.changed).toBe(false);
    expect(prisma.twitchStream.updateMany).not.toHaveBeenCalled();
    expect(prisma.twitchStream.upsert).toHaveBeenCalled();
  });

  it('writes cache only when a new live appears', async () => {
    (prisma.userPreference.findFirst as any).mockResolvedValue({ twitchFollows: 'foo,bar' });
    (prisma.twitchStream.findMany as any).mockResolvedValue([
      { id: '1', url: 'https://twitch.tv/foo' },
    ]);

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          users: [
            {
              login: 'foo',
              displayName: 'Foo',
              profileImageURL: '',
              stream: {
                id: 'live-foo',
                title: 'foo live',
                viewersCount: 10,
                previewImageURL: '',
                game: { name: 'GameA' },
                createdAt: new Date().toISOString(),
              },
            },
            {
              login: 'bar',
              displayName: 'Bar',
              profileImageURL: '',
              stream: {
                id: 'live-bar',
                title: 'bar live',
                viewersCount: 8,
                previewImageURL: '',
                game: { name: 'GameB' },
                createdAt: new Date().toISOString(),
              },
            },
          ],
        },
      }),
    });

    const result = await service.refreshLiveCacheLight();

    expect(result.changed).toBe(true);
    expect(result.newLives).toBe(1);
    expect(prisma.twitchStream.upsert).toHaveBeenCalled();
  });

  it('regression guard: authoritative refresh marks ended live channels offline', async () => {
    (prisma.userPreference.findFirst as any).mockResolvedValue({ twitchFollows: 'foo,bar' });
    (prisma.twitchStream.findMany as any).mockResolvedValue([
      { id: '1', url: 'https://twitch.tv/foo' },
      { id: '2', url: 'https://twitch.tv/bar' },
    ]);

    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          users: [
            {
              login: 'foo',
              displayName: 'Foo',
              profileImageURL: '',
              stream: {
                id: 'live-foo',
                title: 'foo live',
                viewersCount: 10,
                previewImageURL: '',
                game: { name: 'GameA' },
                createdAt: new Date().toISOString(),
              },
            },
          ],
        },
      }),
    });

    // This guard may already be green if authoritative de-live behavior was fixed before this Red task.
    const result = await service.refreshLiveCacheLight();

    expect(result.changed).toBe(true);
    expect(result.endedLives).toBe(1);
    expect(prisma.twitchStream.updateMany).toHaveBeenCalledTimes(1);
    const updatePayload = (prisma.twitchStream.updateMany as any).mock.calls[0][0];
    expect(updatePayload).toEqual(expect.objectContaining({
      data: { isLive: false },
      where: expect.objectContaining({
        id: expect.objectContaining({
          in: expect.arrayContaining(['2']),
        }),
      }),
    }));
    expect(updatePayload.where.id.in).not.toContain('1');
  });
});

describe('TwitchService.getLiveStreamsFast', () => {
  let service: ReturnType<typeof createTwitchService>;
  const originalFetch = (globalThis as any).fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createTwitchService();
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('getLiveStreamsFast returns cache immediately and triggers background refresh', async () => {
    (prisma.userPreference.findFirst as any).mockResolvedValue({ twitchFollows: 'foo' });
    (prisma.twitchStream.findMany as any).mockResolvedValue([
      { id: '1', twitchId: 'live-foo', title: 'foo', url: 'https://twitch.tv/foo', isLive: true },
    ]);
    const refreshSpy = vi.spyOn(service, 'refreshLiveCacheLight').mockResolvedValue({
      changed: false,
      newLives: 0,
      endedLives: 0,
      totalLive: 1,
    });

    const result = await service.getLiveStreamsFast(20);

    expect(result).toHaveLength(1);
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('getLiveStreamsFast returns only fresh cached live rows', async () => {
    (prisma.userPreference.findFirst as any).mockResolvedValue({ twitchFollows: 'foo' });
    (prisma.twitchStream.findMany as any).mockResolvedValue([]);

    vi.spyOn(service, 'refreshLiveCacheLight').mockResolvedValue({
      changed: false,
      newLives: 0,
      endedLives: 0,
      totalLive: 1,
    });

    await service.getLiveStreamsFast(20);

    expect(prisma.twitchStream.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isLive: true,
        fetchedAt: expect.objectContaining({
          gte: expect.any(Date),
        }),
      }),
      take: 20,
      orderBy: { fetchedAt: 'desc' },
    }));
  });
});

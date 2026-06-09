import { prisma } from '../db/prisma.client';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import {
  TIMEOUTS,
  CACHE_TTL,
  FETCH_CONCURRENCY,
  FETCH_BATCH_DELAY_MS,
  RESOLVE_BATCH_CONCURRENCY,
  RESOLVE_NETWORK_FAILURE_THRESHOLD,
  RESOLVE_NETWORK_COOLDOWN_MS,
  RESOLVE_LOG_INTERVAL_MS,
  HANDLE_RETRY_BACKOFF_MS,
  YOUTUBE_VIDEO_BATCH_SIZE,
} from '../config/constants';
import Parser from 'rss-parser';

const rssParser = new Parser({
  timeout: TIMEOUTS.RSS_PARSER,
  headers: { 'User-Agent': 'NightHub/1.0' },
  customFields: {
    item: [['media:group', 'mediaGroup']],
  },
});

const YT_RSS_BASE = 'https://www.youtube.com/feeds/videos.xml';
const YT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const YT_CHANNEL_ID_RE = /^UC[a-zA-Z0-9_-]{22}$/;

type HandleRetryState = {
  attempts: number;
  nextRetryAt: number;
};

type ChannelFetchSource = {
  channelId: string;
  channelHandle?: string;
};

export type YoutubeRemapHandleStatus = 'ok' | 'unresolved' | 'missingStoredId';

export type YoutubeRemapHandleDiagnostic = {
  handle: string;
  resolvedChannelId: string | null;
  status: YoutubeRemapHandleStatus;
  storedMatch: boolean;
  lastSeenChannelName: string;
  lastSeenChannelHandle: string;
};

export type YoutubeOrphanChannelDiagnostic = {
  channelId: string;
  lastSeenChannelName: string;
  lastSeenChannelHandle: string;
};

export type YoutubeRemapReport = {
  generatedAt: string;
  handles: YoutubeRemapHandleDiagnostic[];
  orphanChannelIds: YoutubeOrphanChannelDiagnostic[];
  storedChannelIds: string[];
  resolvedChannelIds: string[];
};

export type YoutubeChannelSearchCandidate = {
  channelId: string;
  title: string;
  handle: string;
  url: string;
  source: 'youtube-api' | 'cache';
};

export class YoutubeService {
  private lastLiveSyncAt = 0;
  private liveSyncInFlight: Promise<void> | null = null;
  private lastFetchAt = 0;
  private fetchInFlight: Promise<void> | null = null;
  private unresolvedHandleRetry = new Map<string, HandleRetryState>();
  private resolveCircuitOpenUntil = 0;
  private resolveConsecutiveNetworkFailures = 0;
  private resolveSuppressedErrors = 0;
  private resolveLastLogAt = 0;
  private static readonly LIVE_SYNC_TTL_MS = CACHE_TTL.LIVE_SYNC;
  private static readonly FETCH_TTL_MS = CACHE_TTL.FETCH;
  private static readonly FETCH_CONCURRENCY = FETCH_CONCURRENCY;
  private static readonly FETCH_BATCH_DELAY_MS = FETCH_BATCH_DELAY_MS;
  private static readonly FETCH_TIMEOUT_MS = TIMEOUTS.FETCH;

  /** Get saved channel handles from preferences */
  async getChannelHandles(): Promise<string[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      if (!pref?.youtubeChannels) return [];
      return pref.youtubeChannels
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  private async persistChannelHandles(normalizedHandles: string[]): Promise<void> {
    const value = normalizedHandles.join(',');
    const existing = await prisma.userPreference.findFirst();
    if (existing) {
      await prisma.userPreference.update({ where: { id: existing.id }, data: { youtubeChannels: value } });
    } else {
      await prisma.userPreference.create({ data: { youtubeChannels: value } });
    }
  }

  private isResolveCircuitOpen(): boolean {
    return Date.now() < this.resolveCircuitOpenUntil;
  }

  private getErrorCode(err: any): string {
    const direct = typeof err?.code === 'string' ? err.code : '';
    if (direct) return direct;
    const cause = err?.cause;
    if (typeof cause?.code === 'string') return cause.code;
    if (Array.isArray(cause?.errors)) {
      for (const nested of cause.errors) {
        if (typeof nested?.code === 'string') return nested.code;
      }
    }
    return '';
  }

  private isLikelyNetworkResolveError(err: any): boolean {
    const code = this.getErrorCode(err);
    if (['ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED'].includes(code)) {
      return true;
    }
    const message = String(err?.message || '').toLowerCase();
    const causeMessage = String(err?.cause?.message || '').toLowerCase();
    return message.includes('fetch failed') ||
      message.includes('timeout') ||
      causeMessage.includes('timeout') ||
      causeMessage.includes('getaddrinfo');
  }

  private recordResolveNetworkError(handle: string, err: any): void {
    this.resolveConsecutiveNetworkFailures += 1;
    this.resolveSuppressedErrors += 1;
    if (this.resolveConsecutiveNetworkFailures >= RESOLVE_NETWORK_FAILURE_THRESHOLD) {
      this.resolveCircuitOpenUntil = Date.now() + RESOLVE_NETWORK_COOLDOWN_MS;
    }

    const now = Date.now();
    if (now - this.resolveLastLogAt >= RESOLVE_LOG_INTERVAL_MS) {
      this.resolveLastLogAt = now;
      const code = this.getErrorCode(err) || 'UNKNOWN';
      const cooldown = this.isResolveCircuitOpen()
        ? Math.max(1, Math.ceil((this.resolveCircuitOpenUntil - now) / 1000))
        : 0;
      logger.warn('YouTube handle resolve network issues', {
        errorCount: this.resolveSuppressedErrors,
        lastHandle: handle,
        code: this.getErrorCode(err) || 'UNKNOWN',
        cooldown: this.isResolveCircuitOpen()
          ? Math.max(1, Math.ceil((this.resolveCircuitOpenUntil - Date.now()) / 1000))
          : 0,
      });
      this.resolveSuppressedErrors = 0;
    }
  }

  private markResolveNetworkSuccess(): void {
    this.resolveConsecutiveNetworkFailures = 0;
    this.resolveCircuitOpenUntil = 0;
  }

  private async resolveHandlesBatch(
    handles: string[],
    options: { force?: boolean; overrides?: Map<string, string> } = {}
  ): Promise<Array<{ handle: string; channelId: string | null }>> {
    const results: Array<{ handle: string; channelId: string | null }> = [];
    const overrides = options.overrides || new Map<string, string>();
    for (let i = 0; i < handles.length; i += RESOLVE_BATCH_CONCURRENCY) {
      const batch = handles.slice(i, i + RESOLVE_BATCH_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (handle) => {
          const overrideId = overrides.get(handle);
          if (overrideId && YT_CHANNEL_ID_RE.test(overrideId)) {
            return { handle, channelId: overrideId };
          }
          return { handle, channelId: await this.resolveChannelId(handle, { force: options.force }) };
        })
      );
      results.push(...batchResults);
    }
    return results;
  }

  private async getCachedChannelIdByHandle(handles: string[]): Promise<Map<string, string>> {
    if (handles.length === 0) return new Map();
    const rows = await prisma.youtubeVideo.findMany({
      where: {
        channelHandle: { in: handles },
      },
      orderBy: { fetchedAt: 'desc' },
      distinct: ['channelHandle'],
      select: {
        channelHandle: true,
        channelId: true,
      },
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      if (typeof row.channelHandle !== 'string') continue;
      const normalized = this.normalizeHandle(row.channelHandle);
      if (!normalized) continue;
      if (!YT_CHANNEL_ID_RE.test(row.channelId)) continue;
      map.set(normalized, row.channelId);
    }
    return map;
  }

  private async buildStableChannelSourcesFromHandles(
    handles: string[],
    resolvedRows: Array<{ handle: string; channelId: string | null }>
  ): Promise<{ sources: ChannelFetchSource[]; channelIds: string[]; usedStoredFallback: boolean; usedCacheFallback: number }> {
    const storedIds = await this.getChannelIds();
    const cachedMap = await this.getCachedChannelIdByHandle(handles);
    const resolvedMap = new Map(resolvedRows.map((row) => [row.handle, row.channelId]));
    const sources: ChannelFetchSource[] = [];
    let usedCacheFallback = 0;

    for (const handle of handles) {
      const resolved = resolvedMap.get(handle);
      if (resolved && YT_CHANNEL_ID_RE.test(resolved)) {
        sources.push({ channelId: resolved, channelHandle: handle });
        continue;
      }
      const cachedId = cachedMap.get(handle);
      if (cachedId && YT_CHANNEL_ID_RE.test(cachedId)) {
        usedCacheFallback += 1;
        sources.push({ channelId: cachedId, channelHandle: handle });
      }
    }

    const uniqueSources = [...new Map(sources.map((s) => [s.channelId, s])).values()];
    let channelIds = uniqueSources.map((s) => s.channelId);

    // Conservative mode: never collapse to zero IDs when we still have stored IDs.
    if (channelIds.length === 0 && storedIds.length > 0) {
      return {
        sources: storedIds.map((channelId) => ({ channelId })),
        channelIds: [...storedIds],
        usedStoredFallback: true,
        usedCacheFallback,
      };
    }

    const lowConfidence =
      storedIds.length > 0 &&
      channelIds.length < Math.max(3, Math.floor(storedIds.length * 0.4));
    if (lowConfidence) {
      channelIds = [...new Set([...channelIds, ...storedIds])];
    }

    return {
      sources: lowConfidence
        ? [...new Map([
          ...uniqueSources.map((s) => [s.channelId, s] as const),
          ...storedIds.map((id) => [id, { channelId: id } as ChannelFetchSource] as const),
        ]).values()]
        : uniqueSources,
      channelIds,
      usedStoredFallback: lowConfidence,
      usedCacheFallback,
    };
  }

  private async reconcileChannelIdsFromHandles(
    handles: string[],
    overrides: Map<string, string> = new Map()
  ): Promise<string[]> {
    if (handles.length === 0) {
      await this.saveChannelIds([]);
      await prisma.youtubeVideo.deleteMany({});
      return [];
    }

    const resolvedRows = await this.resolveHandlesBatch(handles, { force: true, overrides });
    const stable = await this.buildStableChannelSourcesFromHandles(handles, resolvedRows);
    const validIds = stable.channelIds;
    await this.saveChannelIds(validIds);

    if (validIds.length > 0) {
      await prisma.youtubeVideo.deleteMany({
        where: { channelId: { notIn: validIds } },
      });
    } else {
      // No stored IDs and nothing resolved: clear stale cache.
      await prisma.youtubeVideo.deleteMany({});
    }

    return validIds;
  }

  private triggerBackgroundRefresh(): void {
    if (this.fetchInFlight) return;
    this.fetchInFlight = this.fetchAndCacheLatestVideos()
      .finally(() => {
        this.lastFetchAt = Date.now();
        this.fetchInFlight = null;
      })
      .catch((e) => logger.error('FetchAndCacheLatestVideos trigger failed', e));
    setImmediate(() => this.fetchInFlight);
  }

  /** Save channel handles to preferences */
  async saveChannelHandles(handles: string[]): Promise<void> {
    const normalized = handles
      .map(h => this.normalizeHandle(h))
      .filter((h): h is string => Boolean(h));
    try {
      await this.persistChannelHandles(normalized);
      await this.reconcileChannelIdsFromHandles(normalized);
      this.triggerBackgroundRefresh();
    } catch (e) {
      logger.error('Save youtube channels error', e);
    }
  }

  async getRemapReport(
    options: { resolveNetwork?: boolean; maxNetworkResolves?: number } = {}
  ): Promise<YoutubeRemapReport> {
    const rawHandles = await this.getChannelHandles();
    const normalizedHandles = [...new Set(
      rawHandles
        .map((handle) => this.normalizeHandle(handle))
        .filter((handle): handle is string => Boolean(handle))
    )];
    const storedChannelIds = await this.getChannelIds();
    const storedSet = new Set(storedChannelIds);
    const resolveNetwork = Boolean(options.resolveNetwork);
    const maxNetworkResolves = Math.max(0, Math.min(25, options.maxNetworkResolves ?? 8));

    const handleSnapshots = normalizedHandles.length > 0
      ? await prisma.youtubeVideo.findMany({
        where: {
          channelHandle: { in: normalizedHandles },
        },
        orderBy: { fetchedAt: 'desc' },
        distinct: ['channelHandle'],
        select: {
          channelHandle: true,
          channelId: true,
          channelName: true,
        },
      })
      : [];
    const snapshotByHandle = new Map(handleSnapshots.map((row) => [row.channelHandle, row]));

    const resolvedByHandle = new Map<string, string | null>();
    for (const handle of normalizedHandles) {
      const snap = snapshotByHandle.get(handle);
      const channelId = snap?.channelId || '';
      if (YT_CHANNEL_ID_RE.test(channelId)) {
        resolvedByHandle.set(handle, channelId);
      } else {
        resolvedByHandle.set(handle, null);
      }
    }

    if (resolveNetwork) {
      const unresolvedHandles = normalizedHandles.filter((handle) => !resolvedByHandle.get(handle));
      const subset = unresolvedHandles.slice(0, maxNetworkResolves);
      const networkResolved = await Promise.all(
        subset.map(async (handle) => ({
          handle,
          channelId: await this.resolveChannelId(handle, { force: true }),
        }))
      );
      for (const row of networkResolved) {
        if (row.channelId) {
          resolvedByHandle.set(row.handle, row.channelId);
        }
      }
    }

    const resolvedPairs = normalizedHandles.map((handle) => ({
      handle,
      resolvedChannelId: resolvedByHandle.get(handle) || null,
    }));
    const resolvedChannelIds = [...new Set(
      resolvedPairs
        .map((row) => row.resolvedChannelId)
        .filter((id): id is string => Boolean(id))
    )];
    const resolvedSet = new Set(resolvedChannelIds);

    const snapshotIds = [...new Set([
      ...storedChannelIds,
      ...resolvedChannelIds,
      ...handleSnapshots.map((row) => row.channelId).filter((id) => YT_CHANNEL_ID_RE.test(id)),
    ])];
    const snapshots = snapshotIds.length > 0
      ? await prisma.youtubeVideo.findMany({
        where: { channelId: { in: snapshotIds } },
        orderBy: { fetchedAt: 'desc' },
        distinct: ['channelId'],
        select: {
          channelId: true,
          channelName: true,
          channelHandle: true,
        },
      })
      : [];
    const snapshotMap = new Map(snapshots.map((row) => [row.channelId, row]));

    const handles = resolvedPairs.map((row) => {
      const snapshot = row.resolvedChannelId
        ? snapshotMap.get(row.resolvedChannelId)
        : snapshotByHandle.get(row.handle);
      const storedMatch = Boolean(row.resolvedChannelId && storedSet.has(row.resolvedChannelId));
      const status: YoutubeRemapHandleStatus =
        !row.resolvedChannelId ? 'unresolved' : (storedMatch ? 'ok' : 'missingStoredId');
      return {
        handle: row.handle,
        resolvedChannelId: row.resolvedChannelId,
        status,
        storedMatch,
        lastSeenChannelName: snapshot?.channelName || '',
        lastSeenChannelHandle: this.sanitizeHandle(snapshot?.channelHandle),
      };
    });

    const orphanChannelIds = storedChannelIds
      .filter((channelId) => !resolvedSet.has(channelId))
      .map((channelId) => {
        const snapshot = snapshotMap.get(channelId);
        return {
          channelId,
          lastSeenChannelName: snapshot?.channelName || '',
          lastSeenChannelHandle: this.sanitizeHandle(snapshot?.channelHandle),
        };
      });

    return {
      generatedAt: new Date().toISOString(),
      handles,
      orphanChannelIds,
      storedChannelIds,
      resolvedChannelIds,
    };
  }

  async searchChannelsByName(query: string): Promise<YoutubeChannelSearchCandidate[]> {
    const trimmed = query.trim().slice(0, 100);
    if (trimmed.length < 2) return [];

    const candidates = new Map<string, YoutubeChannelSearchCandidate>();
    const apiKey = this.getYouTubeApiKey();

    if (apiKey) {
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=10&q=${encodeURIComponent(trimmed)}&key=${apiKey}`;
        const response = await fetch(url, {
          headers: { 'User-Agent': YT_USER_AGENT },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const data = await response.json();
          const ids = (data?.items || [])
            .map((item: any) => item?.id?.channelId)
            .filter((id: string) => YT_CHANNEL_ID_RE.test(id));

          if (ids.length > 0) {
            const detailsUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${ids.join(',')}&key=${apiKey}`;
            const detailsRes = await fetch(detailsUrl, {
              headers: { 'User-Agent': YT_USER_AGENT },
              signal: AbortSignal.timeout(5000),
            });
            if (detailsRes.ok) {
              const detailsData = await detailsRes.json();
              for (const item of detailsData?.items || []) {
                const channelId = item?.id;
                if (!YT_CHANNEL_ID_RE.test(channelId)) continue;
                const title = item?.snippet?.title || channelId;
                const customUrl = item?.snippet?.customUrl || '';
                const handle = customUrl.startsWith('@') ? customUrl : '';
                const url = handle
                  ? `https://www.youtube.com/${handle}`
                  : `https://www.youtube.com/channel/${channelId}`;
                candidates.set(channelId, {
                  channelId,
                  title,
                  handle,
                  url,
                  source: 'youtube-api',
                });
              }
            }
          }
        }
      } catch {
        // Ignore API search failures and continue with cache fallback.
      }
    }

    const cached = await prisma.youtubeVideo.findMany({
      where: {
        OR: [
          { channelName: { contains: trimmed } },
          { channelHandle: { contains: trimmed } },
        ],
      },
      orderBy: { fetchedAt: 'desc' },
      distinct: ['channelId'],
      take: 10,
      select: {
        channelId: true,
        channelName: true,
        channelHandle: true,
      },
    });
    const snapshotByHandle = new Map(
      cached
        .map((row) => [this.sanitizeHandle(row.channelHandle), row] as const)
        .filter(([handle]) => Boolean(handle))
    );

    for (const row of cached) {
      if (!YT_CHANNEL_ID_RE.test(row.channelId)) continue;
      if (candidates.has(row.channelId)) continue;
      const handle = this.sanitizeHandle(row.channelHandle);
      candidates.set(row.channelId, {
        channelId: row.channelId,
        title: row.channelName || row.channelId,
        handle,
        url: handle
          ? `https://www.youtube.com/${handle}`
          : `https://www.youtube.com/channel/${row.channelId}`,
        source: 'cache',
      });
    }

    if (candidates.size === 0) {
      const handles = await this.getChannelHandles();
      const q = trimmed.toLowerCase();
      const local = handles
        .map((h) => this.normalizeHandle(h))
        .filter((h): h is string => Boolean(h))
        .filter((h) => h.toLowerCase().includes(q))
        .slice(0, 10);
      for (const handle of local) {
        const snap = snapshotByHandle.get(handle);
        const channelId = snap?.channelId || '';
        candidates.set(`${handle}:${channelId || 'unknown'}`, {
          channelId,
          title: snap?.channelName || handle,
          handle,
          url: handle ? `https://www.youtube.com/${handle}` : '',
          source: 'cache',
        });
      }
    }

    return [...candidates.values()]
      .filter((row) => row.handle || YT_CHANNEL_ID_RE.test(row.channelId))
      .slice(0, 10);
  }

  async remapHandleToChannelId(rawHandle: string, rawChannelId: string): Promise<{ handle: string; channelId: string }> {
    const handle = this.normalizeHandle(rawHandle);
    if (!handle) {
      throw new Error('Invalid handle');
    }
    const channelId = rawChannelId.trim();
    if (!YT_CHANNEL_ID_RE.test(channelId)) {
      throw new Error('Invalid channelId');
    }

    const existingHandles = await this.getChannelHandles();
    const normalizedHandles = [...new Set(
      existingHandles
        .map((h) => this.normalizeHandle(h))
        .filter((h): h is string => Boolean(h))
    )];
    if (!normalizedHandles.includes(handle)) {
      normalizedHandles.push(handle);
    }

    await this.persistChannelHandles(normalizedHandles);
    await this.reconcileChannelIdsFromHandles(normalizedHandles, new Map([[handle, channelId]]));
    this.triggerBackgroundRefresh();

    return { handle, channelId };
  }

  /** Resolve a YouTube channel handle (@name) or name to a channel ID */
  async resolveChannelId(handle: string, options: { force?: boolean } = {}): Promise<string | null> {
    const trimmed = handle.trim();
    if (YT_CHANNEL_ID_RE.test(trimmed)) return trimmed;

    const normalized = this.normalizeHandle(trimmed);
    if (!normalized) return null;
    if (!options.force && !this.shouldAttemptHandleResolve(normalized)) {
      return null;
    }
    if (this.isResolveCircuitOpen()) {
      this.markHandleResolveFailure(normalized);
      return null;
    }

    try {
      const byApi = await this.resolveChannelIdByApiHandle(normalized);
      if (byApi) {
        this.markHandleResolveSuccess(normalized);
        this.markResolveNetworkSuccess();
        return byApi;
      }

      const byHtml = await this.resolveChannelIdByHtmlHandle(normalized);
      if (byHtml) {
        this.markHandleResolveSuccess(normalized);
        this.markResolveNetworkSuccess();
        return byHtml;
      }

      this.markHandleResolveFailure(normalized);
      return null;
    } catch (e) {
      this.markHandleResolveFailure(normalized);
      if (this.isLikelyNetworkResolveError(e)) {
        this.recordResolveNetworkError(normalized, e);
      } else {
        logger.error(`Resolve channel ID error for ${handle}`, e);
      }
      return null;
    }
  }

  private normalizeHandle(handle: string): string | null {
    const trimmed = handle.trim();
    if (!trimmed) return null;
    if (YT_CHANNEL_ID_RE.test(trimmed)) return null;
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  }

  private sanitizeHandle(value?: string | null): string {
    return typeof value === 'string' && value.startsWith('@') ? value : '';
  }

  private getYouTubeApiKey(): string | null {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || apiKey === 'your_youtube_data_api_key') return null;
    return apiKey;
  }

  private shouldAttemptHandleResolve(handle: string): boolean {
    const state = this.unresolvedHandleRetry.get(handle);
    if (!state) return true;
    return Date.now() >= state.nextRetryAt;
  }

  private markHandleResolveSuccess(handle: string): void {
    this.unresolvedHandleRetry.delete(handle);
  }

  private markHandleResolveFailure(handle: string): void {
    const current = this.unresolvedHandleRetry.get(handle);
    const attempts = (current?.attempts || 0) + 1;
    const idx = Math.min(attempts - 1, HANDLE_RETRY_BACKOFF_MS.length - 1);
    const nextRetryAt = Date.now() + HANDLE_RETRY_BACKOFF_MS[idx];
    this.unresolvedHandleRetry.set(handle, { attempts, nextRetryAt });
  }

  private canonicalMatchesHandle(canonicalBaseUrl: string, requestedHandle: string): boolean {
    const normalizedCanonical = canonicalBaseUrl
      .replace(/\\\//g, '/')
      .trim()
      .toLowerCase();
    const normalizedRequested = requestedHandle.trim().toLowerCase();
    return normalizedCanonical === `/${normalizedRequested}` || normalizedCanonical.startsWith(`/${normalizedRequested}/`);
  }

  private async resolveChannelIdByApiHandle(handle: string): Promise<string | null> {
    const apiKey = this.getYouTubeApiKey();
    if (!apiKey) return null;

    const forHandle = handle.replace(/^@/, '');
    const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(forHandle)}&key=${apiKey}`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': YT_USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const id = data?.items?.[0]?.id;
      return YT_CHANNEL_ID_RE.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  private async resolveChannelIdByHtmlHandle(handle: string): Promise<string | null> {
    const url = `https://www.youtube.com/${handle}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': YT_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    const canonicalMatch = html.match(/"canonicalBaseUrl":"(\/[^"]+)"/);
    const canonicalBaseUrl = canonicalMatch?.[1];
    if (!canonicalBaseUrl || !this.canonicalMatchesHandle(canonicalBaseUrl, handle)) {
      return null;
    }

    const commandBrowseIdMatch = html.match(/window\['ytCommand'\]\s*=\s*\{[\s\S]*?"browseEndpoint":\{"browseId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (commandBrowseIdMatch && YT_CHANNEL_ID_RE.test(commandBrowseIdMatch[1])) {
      return commandBrowseIdMatch[1];
    }

    const externalIdMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (externalIdMatch && YT_CHANNEL_ID_RE.test(externalIdMatch[1])) {
      return externalIdMatch[1];
    }

    const browseIdMatch = html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/);
    if (browseIdMatch && YT_CHANNEL_ID_RE.test(browseIdMatch[1])) {
      return browseIdMatch[1];
    }

    return null;
  }

  /** Get saved channel IDs from preferences (imported from Google Takeout) */
  async getChannelIds(): Promise<string[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      if (!(pref as any)?.youtubeChannelIds) return [];
      return (pref as any).youtubeChannelIds
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => YT_CHANNEL_ID_RE.test(s));
    } catch {
      return [];
    }
  }

  /**
   * Remove channel IDs that don't correspond to any current handle.
   * Also delete cached videos from removed channels.
   * Call after saveChannelHandles() and at server startup.
   */
  async cleanOrphanChannelIds(): Promise<void> {
    try {
      const handles = await this.getChannelHandles();
      if (handles.length === 0) {
        // No handles = no channels followed, clear everything
        await this.saveChannelIds([]);
        await prisma.youtubeVideo.deleteMany({});
        logger.info('[YouTube] No handles configured, cleared all cached videos');
        return;
      }

      const normalizedHandles = handles
        .map((h) => this.normalizeHandle(h))
        .filter((h): h is string => Boolean(h));
      const resolved = await this.resolveHandlesBatch(normalizedHandles, { force: true });
      const stable = await this.buildStableChannelSourcesFromHandles(normalizedHandles, resolved);
      const validIds = stable.channelIds;
      if (stable.usedStoredFallback) {
        logger.warn('[YouTube] cleanOrphanChannelIds fallback: keeping stored IDs due low-confidence resolve');
      }

      // Get stored IDs
      const storedIds = await this.getChannelIds();

      // Find orphan IDs (in stored but not in resolved)
      const orphanIds = storedIds.filter(id => !validIds.includes(id));

      if (orphanIds.length > 0 && validIds.length > 0) {
        logger.info('[YouTube] Removing orphan channel IDs', { count: orphanIds.length, ids: orphanIds });

        // Delete cached videos from orphan channels
        await prisma.youtubeVideo.deleteMany({
          where: { channelId: { in: orphanIds } },
        });

        // Update stored IDs to only valid ones (or conservative fallback set)
        await this.saveChannelIds(validIds);
      }
    } catch (e) {
      logger.error('[YouTube] Clean orphan channel IDs error', e);
    }
  }

  /** Save channel IDs to preferences */
  async saveChannelIds(ids: string[]): Promise<void> {
    const value = ids.filter(id => YT_CHANNEL_ID_RE.test(id)).join(',');
    try {
      const existing = await prisma.userPreference.findFirst();
      if (existing) {
        await prisma.userPreference.update({ where: { id: existing.id }, data: { youtubeChannelIds: value } });
      } else {
        await prisma.userPreference.create({ data: { youtubeChannelIds: value } });
      }
    } catch (e) {
      logger.error('Save youtube channel IDs error', e);
    }
  }

  /**
   * FAST: Return cached videos from DB (last 7 days, max limit).
   * NEVER blocks on fetch - returns cache immediately, updates in background.
   */
  async getLatestVideos(limit: number = 20): Promise<any[]> {
    const cached = await this.getCachedVideos(limit);

    // Always trigger background update if cache is stale, but don't block
    const now = Date.now();
    const needsUpdate = cached.length === 0 ||
                         (cached.length < limit && now - this.lastFetchAt > YoutubeService.FETCH_TTL_MS);

    if (needsUpdate && !this.fetchInFlight) {
      this.fetchInFlight = this.fetchAndCacheLatestVideos()
        .finally(() => {
          this.lastFetchAt = Date.now();
          this.fetchInFlight = null;
        })
.catch((e) => logger.error('Save youtube channels error', e));
      setImmediate(() => this.fetchInFlight);
    }

    return cached;
  }

  /**
   * Pre-warm the cache at server startup. Returns when complete.
   * Use sparingly - this is slow.
   */
  async preWarmCache(): Promise<void> {
    logger.info('[YouTube] Pre-warming cache...');
    const start = Date.now();
    await this.fetchAndCacheLatestVideos();
    this.lastFetchAt = Date.now();
    logger.info('[YouTube] Cache warmed', { durationMs: Date.now() - start });
  }

  /**
   * SLOW: Fetch all channels via RSS in parallel batches, save to DB.
   * Called by refresh jobs, cron, and pre-warm. NOT called by getDashboardData.
   */
  async fetchAndCacheLatestVideos(): Promise<void> {
    const deadlineAt = Date.now() + YoutubeService.FETCH_TIMEOUT_MS;
    const handles = await this.getChannelHandles();
    const sources: ChannelFetchSource[] = [];

    if (handles.length > 0) {
      const normalizedHandles = handles
        .map((rawHandle) => this.normalizeHandle(rawHandle))
        .filter((handle): handle is string => Boolean(handle));
      const resolved = await this.resolveHandlesBatch(normalizedHandles);
      const stable = await this.buildStableChannelSourcesFromHandles(normalizedHandles, resolved);
      const validIds = stable.channelIds;
      const uniqueResolved = stable.sources;

      await this.saveChannelIds(validIds);

      if (validIds.length > 0) {
        await prisma.youtubeVideo.deleteMany({
          where: { channelId: { notIn: validIds } },
        });
      } else {
        await prisma.youtubeVideo.deleteMany({});
      }

      sources.push(...uniqueResolved);
    } else {
      const channelIds = await this.getChannelIds();
      sources.push(...channelIds.map((channelId) => ({ channelId })));
    }

    if (sources.length === 0) return;

    logger.info('[YouTube] Fetching channels', {
      count: sources.length,
      concurrency: YoutubeService.FETCH_CONCURRENCY,
      timeoutMs: YoutubeService.FETCH_TIMEOUT_MS,
    });

    const allVideos: any[] = [];

    // Process in parallel batches
    for (let i = 0; i < sources.length; i += YoutubeService.FETCH_CONCURRENCY) {
      if (Date.now() >= deadlineAt) {
        logger.warn('[YouTube] Fetch timeout reached before finishing all batches');
        break;
      }

      const batch = sources.slice(i, i + YoutubeService.FETCH_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(source => this.fetchChannelVideos(source))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allVideos.push(...r.value);
      }

      const hasNextBatch = i + YoutubeService.FETCH_CONCURRENCY < sources.length;
      if (hasNextBatch) {
        await this.delay(YoutubeService.FETCH_BATCH_DELAY_MS);
      }
    }

    if (allVideos.length === 0) return;

    // Fetch durations from YouTube Data API v3 in ONE global batch (optional — requires YOUTUBE_API_KEY)
    const videoIds = allVideos.map((v: any) => v.youtubeId).filter(Boolean);
    const durationsMap = await this.fetchDurations(videoIds);

    for (const v of allVideos) {
      const iso = durationsMap.get(v.youtubeId) || '';
      v.duration = this.formatDuration(iso);
      v.durationSeconds = this.parseDurationSeconds(iso);
    }

    const filtered = allVideos
      .filter((v: any) => !this.isShort(v))
      .sort((a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

    if (filtered.length > 0) {
      await this.cacheVideos(filtered.slice(0, 50));
      logger.info('[YouTube] Cached videos', { count: Math.min(filtered.length, 50) });
    }
  }

  /** Fetch and process a single channel's RSS feed */
  private async fetchChannelVideos(source: string | ChannelFetchSource): Promise<any[]> {
    let channelId: string | null = null;
    let channelHandle = '';

    if (typeof source === 'string') {
      // If input is already a channelId (UCxxx), use it directly
      if (YT_CHANNEL_ID_RE.test(source)) {
        channelId = source;
      } else {
        // Input is a handle (@xxx), resolve to channelId
        const normalized = this.normalizeHandle(source);
        if (normalized) {
          channelHandle = normalized;
          channelId = await this.resolveChannelId(normalized);
        }
      }
    } else {
      channelId = source.channelId;
      channelHandle = source.channelHandle || '';
    }

    if (!channelId || !YT_CHANNEL_ID_RE.test(channelId)) return [];

    try {
      const feedUrl = `${YT_RSS_BASE}?channel_id=${channelId}`;
      const feed = await this.parseRSSWithRetry(feedUrl);
      const channelName = feed.title || channelHandle || channelId;
      const items = feed.items || [];
      if (items.length > 0) {
        logger.debug('[YouTube] RSS fetch', {
        channelName,
        channelId,
        itemCount: items.length,
        firstTitle: items[0].title?.substring(0, 40),
        pubDate: items[0].pubDate || items[0].isoDate,
      });
      }

      const mapped = items
        .slice(0, 15)
        .map((item: any) => {
          const videoId = item.id?.replace('yt:video:', '') || '';
          const mediaGroup = item.mediaGroup || {};
          const views = parseInt(
            mediaGroup?.['media:community']?.['media:statistics']?.['$']?.views || '0', 10
          );
          const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
          const title = item.title || 'No title';
          const isLive = this.isLiveStream(title);
          return {
            youtubeId: videoId,
            title,
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channelName,
            channelAvatar: '',
            channelId,
            channelHandle,
            duration: '',
            durationSeconds: 0,
            views,
            url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
            isNew: this.isRecent(pubDate) && !isLive,
            isLive,
            publishedAt: pubDate,
          };
        });
      await this.enrichLiveStatus(mapped);
      return mapped;
    } catch (e) {
      logger.error(`YouTube RSS error for ${channelHandle || channelId}`, e);
      return [];
    }
  }

  /**
   * Improve live detection for very recent uploads whose title does not include
   * explicit live keywords.
   */
  private async enrichLiveStatus(videos: any[]): Promise<void> {
    const candidates = videos
      .filter((v: any) => !v.isLive && this.isRecent(v.publishedAt))
      .slice(0, 3);

    if (candidates.length === 0) return;

    await Promise.all(candidates.map(async (video: any) => {
      const live = await this.isVideoCurrentlyLive(video.youtubeId);
      if (live) {
        video.isLive = true;
        video.isNew = false;
      }
    }));
  }

  private async delay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async parseRSSWithRetry(url: string): Promise<any> {
    const maxRetries = 3;
    const delays = [1000, 2000, 4000];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await rssParser.parseURL(url);
      } catch (err: any) {
        const isRetryable = err?.status === 404 || err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout') || err?.message?.includes('404');
        if (attempt === maxRetries || !isRetryable) {
          throw err;
        }
        const jitter = Math.round(Math.random() * 500);
        const wait = delays[attempt] + jitter;
        logger.warn(`[YouTube] RSS parse attempt ${attempt + 1} failed for ${url}, retrying`, { waitMs: wait });
        await new Promise(r => setTimeout(r, wait));
      }
    }
    throw new Error('Unreachable');
  }

  /** Batch-fetch video durations: API v3 first, then Piped fallback */
  private async fetchDurations(videoIds: string[]): Promise<Map<string, string>> {
    if (!videoIds.length) return new Map();

    const apiKey = process.env.YOUTUBE_API_KEY;
    const hasValidApiKey = apiKey && apiKey !== 'your_youtube_data_api_key';

    if (hasValidApiKey) {
      const durations = await this.fetchYouTubeApiDurations(videoIds, apiKey as string);
      const missing = videoIds.filter(id => !durations.has(id) || !durations.get(id));
      if (missing.length === 0) return durations;

      // Fallback to Piped for missing durations
      const pipedDurations = await this.fetchPipedDurations(missing);
      for (const [id, iso] of pipedDurations) {
        durations.set(id, iso);
      }
      return durations;
    }

    // No API key: use Piped exclusively
    return this.fetchPipedDurations(videoIds);
  }

  /** Fetch durations from YouTube Data API v3 */
  private async fetchYouTubeApiDurations(videoIds: string[], apiKey: string): Promise<Map<string, string>> {
    const durations = new Map<string, string>();
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = videoIds.slice(i, i + 50).join(',');
      const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch}&key=${apiKey}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        for (const item of data.items || []) {
          durations.set(item.id, item.contentDetails?.duration || '');
        }
      } catch (e) {
        logger.error('YouTube Data API v3 duration fetch error', e);
      }
    }
    return durations;
  }

  /** Fetch durations from Piped/Invidious instance as fallback */
  private async fetchPipedDurations(videoIds: string[]): Promise<Map<string, string>> {
    const instanceUrl = config.piped.instanceUrl;
    if (!instanceUrl || !videoIds.length) {
      return new Map();
    }

    const durations = new Map<string, string>();
    const CONCURRENCY = 10;

    for (let i = 0; i < videoIds.length; i += CONCURRENCY) {
      const batch = videoIds.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(id => this.fetchPipedStream(instanceUrl, id))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled' && result.value > 0) {
          durations.set(batch[j], this.secondsToIsoDuration(result.value));
        }
      }
    }

    if (durations.size > 0) {
      logger.info('[YouTube] Piped fallback resolved durations', { resolved: durations.size, total: videoIds.length });
    }
    return durations;
  }

  /** Fetch a single video stream from Piped to extract duration */
  private async fetchPipedStream(instanceUrl: string, videoId: string): Promise<number> {
    try {
      const url = `${instanceUrl.replace(/\/$/, '')}/streams/${videoId}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': YT_USER_AGENT },
      });
      if (!res.ok) return 0;
      const data = await res.json();
      return typeof data.duration === 'number' ? data.duration : 0;
    } catch {
      return 0;
    }
  }

  /** Convert seconds to ISO 8601 duration */
  private secondsToIsoDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return '';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    let iso = 'PT';
    if (h > 0) iso += `${h}H`;
    if (m > 0 || (h > 0 && s === 0)) iso += `${m}M`;
    if (s > 0 || (h === 0 && m === 0)) iso += `${s}S`;
    return iso;
  }

  /** Parse ISO 8601 duration to total seconds (PT1H2M3S → 3723) */
  private parseDurationSeconds(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1] || '0') * 3600)
         + (parseInt(match[2] || '0') * 60)
         + parseInt(match[3] || '0');
  }

  /** Format ISO 8601 duration for display (PT2M30S → "2:30", PT1H5M3S → "1:05:03") */
  private formatDuration(iso: string): string {
    const total = this.parseDurationSeconds(iso);
    if (total === 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Detect YouTube Shorts: #shorts in title, /shorts/ in URL, or duration < 60s */
  private isShort(video: any): boolean {
    const title = (video.title || '').toLowerCase();
    const url = (video.url || '').toLowerCase();
    const isHashShort = title.includes('#shorts') || title.includes('#short') || url.includes('/shorts/');
    const isDurationShort = video.durationSeconds > 0 && video.durationSeconds < 60;
    return isHashShort || isDurationShort;
  }

  /** Heuristic: detect live streams from title keywords */
  private isLiveStream(title: string): boolean {
    const t = title.toLowerCase();
    return /\b(live|en direct|🔴|premiere|première)\b/.test(t);
  }

  private isRecent(pubDate?: string): boolean {
    if (!pubDate) return false;
    const diffHours = (Date.now() - new Date(pubDate).getTime()) / (1000 * 60 * 60);
    return diffHours < 48;
  }

  private async cacheVideos(videos: any[]): Promise<void> {
    try {
      for (const v of videos) {
        if (!v.youtubeId) continue;
        await prisma.youtubeVideo.upsert({
          where: { youtubeId: v.youtubeId },
          update: {
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            channelName: v.channelName,
            channelAvatar: v.channelAvatar,
            channelId: v.channelId || '',
            channelHandle: v.channelHandle || '',
            duration: v.duration || '',
            url: v.url,
            isNew: v.isNew,
            isLive: v.isLive || false,
            views: v.views || 0,
            publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined,
          },
          create: {
            youtubeId: v.youtubeId,
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            channelName: v.channelName,
            channelAvatar: v.channelAvatar,
            channelId: v.channelId || '',
            channelHandle: v.channelHandle || '',
            duration: v.duration || '',
            views: v.views || 0,
            url: v.url,
            isNew: v.isNew,
            isLive: v.isLive || false,
            publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
          },
        });
      }
    } catch (e) {
      logger.error('Cache videos error', e);
    }
  }

  async getCachedVideos(limit: number = 20): Promise<any[]> {
    try {
      const channelIds = await this.getChannelIds();

      if (channelIds.length === 0) return [];

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const videos = await prisma.youtubeVideo.findMany({
        where: {
          publishedAt: { gte: sevenDaysAgo },
          isLive: false,
          channelId: { in: channelIds },
        },
        select: {
          youtubeId: true,
          title: true,
          thumbnailUrl: true,
          channelName: true,
          channelAvatar: true,
          channelId: true,
          channelHandle: true,
          duration: true,
          views: true,
          url: true,
          isNew: true,
          isLive: true,
          publishedAt: true,
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      });
      const sanitized = videos.map((video) => ({
        ...video,
        channelHandle: this.sanitizeHandle(video.channelHandle),
      }));
      logger.debug('getCachedVideos', { count: sanitized.length, limit, channelIds: channelIds.length });
      if (sanitized.length > 0) {
        logger.debug('getCachedVideos sample', {
          channelName: sanitized[0].channelName,
          title: sanitized[0].title?.substring(0, 40),
          publishedAt: sanitized[0].publishedAt,
        });
      }
      return sanitized;
    } catch (e) {
      logger.error('getCachedVideos error', e);
      return [];
    }
  }

  async getCachedLiveStreams(limit: number = 20): Promise<any[]> {
    try {
      await this.syncLiveCacheIfNeeded();

      const channelIds = await this.getChannelIds();

      if (channelIds.length === 0) return [];

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const videos = await prisma.youtubeVideo.findMany({
        where: {
          publishedAt: { gte: threeDaysAgo },
          isLive: true,
          channelId: { in: channelIds },
        },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      });
      return videos.map((video: any) => ({
        ...video,
        channelHandle: this.sanitizeHandle(video.channelHandle),
      }));
    } catch {
      return [];
    }
  }

  private async syncLiveCacheIfNeeded(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastLiveSyncAt < YoutubeService.LIVE_SYNC_TTL_MS) {
      return;
    }

    if (this.liveSyncInFlight) {
      await this.liveSyncInFlight;
      return;
    }

    this.liveSyncInFlight = (async () => {
      await this.fetchAndCacheLatestVideos();
      await this.verifyAndCleanLiveStreams();
      this.lastLiveSyncAt = Date.now();
    })();

    try {
      await this.liveSyncInFlight;
    } finally {
      this.liveSyncInFlight = null;
    }
  }

  /**
   * Verify which cached live videos are actually still live.
   * Uses Piped /streams/{videoId} endpoint which returns { livestream: boolean }.
   * Falls back to YouTube oEmbed if Piped unavailable.
   * Updates DB: sets isLive = false for ended streams.
   */
  async verifyAndCleanLiveStreams(): Promise<void> {
    const liveVideos = await prisma.youtubeVideo.findMany({
      where: { isLive: true },
      select: { youtubeId: true, id: true },
    });

    if (liveVideos.length === 0) return;

    logger.info('[YouTube] Verifying live streams', { count: liveVideos.length });

    for (const video of liveVideos) {
      try {
        const stillLive = await this.isVideoCurrentlyLive(video.youtubeId);

        if (!stillLive) {
          await prisma.youtubeVideo.update({
            where: { id: video.id },
            data: { isLive: false },
          });
          logger.info('[YouTube] Live ended', { youtubeId: video.youtubeId });
        }
      } catch (e) {
        // On error, leave isLive unchanged (conservative)
        logger.warn(`[YouTube] Failed to verify live status for ${video.youtubeId}`, { error: e });
      }
    }
  }

  /**
   * Check current live status from Piped when available, then YouTube watch page fallback.
   */
  private async isVideoCurrentlyLive(videoId: string): Promise<boolean> {
    const instanceUrl = config.piped.instanceUrl;
    let pipedLive: boolean | null = null;

    if (instanceUrl) {
      try {
        const pipedUrl = `${instanceUrl.replace(/\/$/, '')}/streams/${videoId}`;
        const pipedRes = await fetch(pipedUrl, {
          headers: { 'User-Agent': YT_USER_AGENT },
          signal: AbortSignal.timeout(5000),
        });
        if (pipedRes.ok) {
          const data = await pipedRes.json();
          if (typeof data?.livestream === 'boolean') {
            pipedLive = data.livestream;
          }
        }
      } catch {
        // Fall through to YouTube watch page fallback.
      }
    }

    try {
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const ytRes = await fetch(ytUrl, {
        headers: { 'User-Agent': YT_USER_AGENT },
        signal: AbortSignal.timeout(5000),
      });
      if (!ytRes.ok) return pipedLive ?? false;
      const html = await ytRes.text();
      // If YouTube watch page is reachable, trust its explicit live-now signal.
      return html.includes('"isLiveNow":true');
    } catch {
      return pipedLive ?? false;
    }
  }

  /** Legacy OAuth stubs - replaced by RSS approach */
  getAuthUrl(): string { return ''; }
  async exchangeCodeForTokens(_code: string): Promise<boolean> { return false; }
  async getSubscriptions(): Promise<any[]> { return this.getLatestVideos(); }
  async isConnected(): Promise<boolean> {
    const handles = await this.getChannelHandles();
    return handles.length > 0;
  }
  async disconnect(): Promise<void> {
    await this.saveChannelHandles([]);
  }
}

export const youtubeService = new YoutubeService();

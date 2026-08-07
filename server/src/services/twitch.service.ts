import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';
import { TIMEOUTS, CACHE_TTL } from '../config/constants';

const TWITCH_GQL = 'https://gql.twitch.tv/gql';
// Twitch's own web client-id (public, used by twitch.tv website)
const TWITCH_WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const TWITCH_GQL_TIMEOUT_MS = TIMEOUTS.GQL;

const GQL_HEADERS = {
  'Client-Id': TWITCH_WEB_CLIENT_ID,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
};

async function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TWITCH_GQL_TIMEOUT_MS);

  try {
    const res = await fetch(TWITCH_GQL, {
      method: 'POST',
      headers: GQL_HEADERS,
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export class TwitchService {
  private lastLightRefreshAt = 0;
  private lightRefreshInFlight: Promise<void> | null = null;
  private authoritativeRefreshInFlight: Promise<{ changed: boolean; newLives: number; endedLives: number; totalLive: number }> | null = null;
  private static readonly LIGHT_REFRESH_TTL_MS = CACHE_TTL.LIGHT_REFRESH;
  private static readonly LIVE_CACHE_MAX_AGE_MS = CACHE_TTL.LIVE_CACHE_MAX_AGE;

  private extractChannelLoginFromUrl(url: string): string {
    const match = url.match(/twitch\.tv\/([^/?#]+)/i);
    return (match?.[1] || '').toLowerCase();
  }

  private async fetchUsersByLogins(logins: string[]): Promise<any[]> {
    const data = await gql(`
      query GetStreams($logins: [String!]!) {
        users(logins: $logins) {
          id login displayName
          profileImageURL(width: 70)
          stream {
            id title viewersCount
            previewImageURL(width: 320, height: 180)
            game { name }
            createdAt
          }
        }
      }
    `, { logins });
    return data?.data?.users || [];
  }

  /** Get followed channels config from DB preferences */
  async getFollowedChannels(): Promise<string[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      if (!pref?.twitchFollows) return [];
      return pref.twitchFollows
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /** Save channel list to preferences */
  async saveFollowedChannels(channels: string[]): Promise<void> {
    const value = channels.map(c => c.trim().toLowerCase()).filter(Boolean).join(',');
    try {
      const existing = await prisma.userPreference.findFirst();
      if (existing) {
        await prisma.userPreference.update({ where: { id: existing.id }, data: { twitchFollows: value } });
      } else {
        await prisma.userPreference.create({ data: { twitchFollows: value } });
      }
    } catch (e) {
      logger.error('Save twitch follows error', e);
    }
  }

  /** Get public follows list for any Twitch username via GQL */
  async getFollowsByProfile(username: string): Promise<any[]> {
    try {
      const data = await gql(`
        query GetUser($login: String!) {
          user(login: $login) {
            id login displayName
            profileImageURL(width: 70)
            stream { id title viewersCount game { name } createdAt }
          }
        }
      `, { login: username.toLowerCase() });

      const user = data?.data?.user;
      if (!user) return [];

      return [{
        channelId: user.id,
        channelName: user.displayName,
        channelLogin: user.login,
        channelAvatar: user.profileImageURL,
        isLive: !!user.stream,
        gameName: user.stream?.game?.name || '',
        viewers: user.stream?.viewersCount || 0,
        streamTitle: user.stream?.title || '',
      }];
    } catch (e) {
      logger.error('getFollowsByProfile error', e);
      return [];
    }
  }

  /**
   * Import follows from a pasted list of channel names.
   * Validates each channel exists on Twitch before saving.
   */
  async importFollowsFromList(channelNames: string[]): Promise<{ imported: number; channels: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    // Batch validate channels using GQL
    const cleaned = channelNames.map(c => c.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);

    // Check in batches of 50
    for (let i = 0; i < cleaned.length; i += 50) {
      const batch = cleaned.slice(i, i + 50);
      try {
        const data = await gql(`
          query GetUsers($logins: [String!]!) {
            users(logins: $logins) {
              login
            }
          }
        `, { logins: batch });

        const foundLogins = new Set(
          (data?.data?.users || []).map((u: any) => u.login.toLowerCase())
        );

        for (const name of batch) {
          if (foundLogins.has(name)) {
            valid.push(name);
          } else {
            invalid.push(name);
          }
        }
      } catch {
        // If GQL fails, assume all are valid
        valid.push(...batch);
      }
    }

    if (valid.length > 0) {
      const existing = await this.getFollowedChannels();
      const merged = [...new Set([...existing, ...valid])];
      await this.saveFollowedChannels(merged);
    }

    return { imported: valid.length, channels: valid, invalid };
  }

  /** Get live streams for the configured channel list */
  async getFollowedStreams(): Promise<any[]> {
    const channels = await this.getFollowedChannels();

    if (channels.length === 0) {
      return [];
    }

    try {
      const users = await this.fetchUsersByLogins(channels);
      logger.info('[Twitch] GQL response', { userCount: users.length });
      const liveUsers = users.filter(u => u.stream !== null);
      logger.info('[Twitch] Live status', { live: liveUsers.length, total: users.length });
      liveUsers.forEach((u, i) => {
        logger.debug('[Twitch] Live stream details', {
        displayName: u.displayName,
        title: u.stream.title?.substring(0, 50),
        viewers: u.stream.viewersCount,
        game: u.stream.game?.name,
      });
      });
      const liveStreams = liveUsers
        .map(u => ({
          twitchId: u.stream.id,
          title: u.stream.title,
          thumbnailUrl: u.stream.previewImageURL ||
            `https://static-cdn.jtvnw.net/previews-ttv/live_user_${u.login}-320x180.jpg`,
          viewerCount: u.stream.viewersCount,
          channelName: u.displayName,
          channelLogin: u.login,
          channelAvatar: u.profileImageURL,
          gameName: u.stream.game?.name || 'Unknown',
          isLive: true,
          url: `https://twitch.tv/${u.login}`,
          createdAt: u.stream.createdAt,
        }));

      // Cache live streams
      if (liveStreams.length > 0) {
        await this.cacheStreams(liveStreams);
      }

      return liveStreams;
    } catch (e) {
      logger.error('getFollowedStreams GQL error', e);
      return this.getCachedStreams();
    }
  }

  /**
   * Authoritative refresh:
   * - queries followed users once
   * - reconciles cached live rows against current live response
   * - marks ended/rotated rows offline and refreshes current live rows
   */
  async refreshLiveCacheLight(): Promise<{ changed: boolean; newLives: number; endedLives: number; totalLive: number }> {
    if (this.authoritativeRefreshInFlight) {
      return this.authoritativeRefreshInFlight;
    }

    this.authoritativeRefreshInFlight = (async () => {
      const channels = await this.getFollowedChannels();
      if (channels.length === 0) {
        return { changed: false, newLives: 0, endedLives: 0, totalLive: 0 };
      }

      const users = await this.fetchUsersByLogins(channels);
      const liveUsers = users.filter((u: any) => u.stream !== null);
      const liveStreams = liveUsers.map((u: any) => ({
        twitchId: u.stream.id,
        title: u.stream.title,
        thumbnailUrl: u.stream.previewImageURL ||
          `https://static-cdn.jtvnw.net/previews-ttv/live_user_${u.login}-320x180.jpg`,
        viewerCount: u.stream.viewersCount,
        channelName: u.displayName,
        channelLogin: u.login,
        channelAvatar: u.profileImageURL,
        gameName: u.stream.game?.name || 'Unknown',
        isLive: true,
        url: `https://twitch.tv/${u.login}`,
        createdAt: u.stream.createdAt,
      }));

      const liveLogins = new Set(
        liveStreams
          .map((s: any) => (s.channelLogin || '').toLowerCase())
          .filter(Boolean)
      );
      const liveStreamIdsByLogin = new Map<string, Set<string>>();
      for (const s of liveStreams) {
        const login = (s.channelLogin || '').toLowerCase();
        if (!login) continue;
        const set = liveStreamIdsByLogin.get(login) || new Set<string>();
        set.add(s.twitchId);
        liveStreamIdsByLogin.set(login, set);
      }

      const cachedLive = await prisma.twitchStream.findMany({
        where: { isLive: true },
        select: { id: true, url: true, twitchId: true },
      });
      const cachedLogins = new Set(
        cachedLive
          .map((s) => this.extractChannelLoginFromUrl(s.url))
          .filter(Boolean)
      );

      const newLives = [...liveLogins].filter((login) => !cachedLogins.has(login)).length;

      // End rows where channel is offline now OR channel is still live with a different stream id.
      const endedIds = cachedLive
        .filter((s) => {
          const login = this.extractChannelLoginFromUrl(s.url);
          if (!login) return false;
          if (!liveLogins.has(login)) return true;

          const currentStreamIds = liveStreamIdsByLogin.get(login);
          if (!currentStreamIds || !s.twitchId) return false;
          return !currentStreamIds.has(s.twitchId);
        })
        .map((s) => s.id);
      const endedLives = endedIds.length;
      const changed = newLives > 0 || endedLives > 0;

      if (endedIds.length > 0) {
        await prisma.twitchStream.updateMany({
          where: { id: { in: endedIds } },
          data: { isLive: false },
        });
      }

      if (liveStreams.length > 0) {
        await this.cacheStreams(liveStreams);
      }

      if (!changed) {
        return { changed: false, newLives: 0, endedLives: 0, totalLive: liveStreams.length };
      }

      return { changed: true, newLives, endedLives, totalLive: liveStreams.length };
    })()
      .catch((e) => {
        // Keep callers resilient even if refresh fails.
        logger.error('[Twitch] refreshLiveCacheLight error', e);
        return { changed: false, newLives: 0, endedLives: 0, totalLive: 0 };
      })
      .finally(() => {
        this.authoritativeRefreshInFlight = null;
      });

    return this.authoritativeRefreshInFlight;
  }

  /** Get all channels (live + offline) from config */
  async getAllChannels(): Promise<any[]> {
    const channels = await this.getFollowedChannels();
    if (channels.length === 0) return [];

    try {
      const data = await gql(`
        query GetChannels($logins: [String!]!) {
          users(logins: $logins) {
            id login displayName
            profileImageURL(width: 70)
            stream {
              id title viewersCount
              game { name }
            }
          }
        }
      `, { logins: channels });

      return (data?.data?.users || []).map((u: any) => ({
        channelId: u.id,
        channelName: u.displayName,
        channelLogin: u.login,
        channelAvatar: u.profileImageURL,
        isLive: !!u.stream,
        gameName: u.stream?.game?.name || '',
        viewers: u.stream?.viewersCount || 0,
        streamTitle: u.stream?.title || '',
        url: `https://twitch.tv/${u.login}`,
      }));
    } catch (e) {
      logger.error('getAllChannels error', e);
      return [];
    }
  }

  private async cacheStreams(streams: any[]): Promise<void> {
    try {
      for (const s of streams) {
        await prisma.twitchStream.upsert({
          where: { twitchId: s.twitchId },
          update: {
            title: s.title,
            thumbnailUrl: s.thumbnailUrl,
            viewerCount: s.viewerCount,
            channelName: s.channelName,
            channelAvatar: s.channelAvatar,
            gameName: s.gameName,
            isLive: s.isLive,
            url: s.url,
            fetchedAt: new Date(),
          },
          create: {
            twitchId: s.twitchId,
            title: s.title,
            thumbnailUrl: s.thumbnailUrl,
            viewerCount: s.viewerCount,
            channelName: s.channelName,
            channelAvatar: s.channelAvatar,
            gameName: s.gameName,
            isLive: s.isLive,
            url: s.url,
            fetchedAt: new Date(),
          },
        });
      }
    } catch (e) {
      logger.error('Cache streams error', e);
    }
  }

  private async getCachedStreams(limit: number = 20): Promise<any[]> {
    try {
      const freshAfter = new Date(Date.now() - TwitchService.LIVE_CACHE_MAX_AGE_MS);
      return await prisma.twitchStream.findMany({
        where: {
          isLive: true,
          fetchedAt: { gte: freshAfter },
        },
        take: limit,
        orderBy: { fetchedAt: 'desc' },
      });
    } catch {
      return [];
    }
  }

  private triggerLightRefreshIfStale(): void {
    const now = Date.now();
    if (this.lightRefreshInFlight) return;
    if (now - this.lastLightRefreshAt < TwitchService.LIGHT_REFRESH_TTL_MS) return;

    this.lightRefreshInFlight = this.refreshLiveCacheLight()
      .then(() => {
        this.lastLightRefreshAt = Date.now();
      })
      .catch((e) => {
        // Do not move lastLightRefreshAt on failure, so retries can happen sooner.
        logger.error('[Twitch] light background refresh failed', e);
      })
      .finally(() => {
        this.lightRefreshInFlight = null;
      });
  }

  /**
   * Dashboard-safe method:
   * returns cached streams immediately and refreshes in background if stale.
   */
  async getLiveStreamsFast(limit: number = 20): Promise<any[]> {
    const followed = await this.getFollowedChannels();
    if (followed.length === 0) return [];

    const cached = await this.getCachedStreams(limit);
    this.triggerLightRefreshIfStale();
    return cached;
  }

  /** ---- Twitch OAuth (Twitch Turbo-aware playback) ---- */

  private readonly TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/authorize';
  private readonly TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
  private static readonly TOKEN_USER_ID = 'local';

  private getTwitchClientConfig() {
    return {
      clientId: process.env.TWITCH_CLIENT_ID || '',
      clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
      redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3001/api/auth/twitch/callback',
    };
  }

  getAuthUrl(): string {
    const { clientId, redirectUri } = this.getTwitchClientConfig();
    if (!clientId) return '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'user:read:email',
    });
    return `${this.TWITCH_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const { clientId, clientSecret, redirectUri } = this.getTwitchClientConfig();
      if (!clientId || !clientSecret) return false;

      const res = await fetch(this.TWITCH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        logger.error('[Twitch] Token exchange failed', { status: res.status });
        return false;
      }
      const data: any = await res.json();
      if (!data.access_token) return false;

      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      await prisma.oAuthToken.upsert({
        where: { provider_userId: { provider: 'twitch', userId: TwitchService.TOKEN_USER_ID } },
        update: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? null,
          expiresAt,
        },
        create: {
          provider: 'twitch',
          userId: TwitchService.TOKEN_USER_ID,
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? null,
          expiresAt,
        },
      });
      logger.info('[Twitch] OAuth tokens stored');
      return true;
    } catch (e) {
      logger.error('[Twitch] Token exchange error', e);
      return false;
    }
  }

  private async getAccessToken(): Promise<string | null> {
    try {
      const row = await prisma.oAuthToken.findUnique({
        where: { provider_userId: { provider: 'twitch', userId: TwitchService.TOKEN_USER_ID } },
      });
      if (!row) return null;

      const expiresAt = row.expiresAt ? row.expiresAt.getTime() : 0;
      if (expiresAt - Date.now() < 5 * 60 * 1000) {
        if (!row.refreshToken) return null;
        const { clientId, clientSecret } = this.getTwitchClientConfig();
        const res = await fetch(this.TWITCH_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: row.refreshToken,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          logger.error('[Twitch] Token refresh failed', { status: res.status });
          return null;
        }
        const data: any = await res.json();
        if (!data.access_token) return null;
        await prisma.oAuthToken.update({
          where: { id: row.id },
          data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? row.refreshToken,
            expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
          },
        });
        return data.access_token;
      }
      return row.accessToken;
    } catch (e) {
      logger.error('[Twitch] getAccessToken error', e);
      return null;
    }
  }

  async isConnected(): Promise<boolean> {
    return (await this.getAccessToken()) !== null;
  }

  async disconnect(): Promise<void> {
    try {
      await prisma.oAuthToken.deleteMany({ where: { provider: 'twitch' } });
      logger.info('[Twitch] OAuth tokens removed');
    } catch (e) {
      logger.error('[Twitch] disconnect error', e);
    }
  }

  /**
   * Playback token for the embedded player. When the user's Twitch account is
   * connected (OAuth), the token is viewer-authenticated so Twitch Turbo /
   * Prime removes preroll ads. Falls back to anonymous playback otherwise.
   */
  async getPlaybackToken(channelLogin: string): Promise<{
    auth?: string;
    sig?: string;
    expiresAt?: string;
    anonymous: boolean;
  }> {
    const token = await this.getAccessToken();
    if (!token) return { anonymous: true };

    try {
      const { clientId } = this.getTwitchClientConfig();
      const headers = { 'Client-Id': clientId, Authorization: `Bearer ${token}` };

      const userRes = await fetch(
        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelLogin)}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!userRes.ok) {
        logger.error('[Twitch] helix users failed', { status: userRes.status });
        return { anonymous: true };
      }
      const users = await userRes.json();
      const userId = users?.data?.[0]?.id;
      if (!userId) return { anonymous: true };

      const tokRes = await fetch(
        `https://api.twitch.tv/helix/streams/playback/token?user_id=${userId}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!tokRes.ok) {
        logger.error('[Twitch] playback token failed', { status: tokRes.status });
        return { anonymous: true };
      }
      const tok = await tokRes.json();
      const item = tok?.data?.[0];
      if (!item?.value) return { anonymous: true };

      return {
        auth: item.value,
        sig: item.signature,
        expiresAt: item.expires_at,
        anonymous: false,
      };
    } catch (e) {
      logger.error('[Twitch] getPlaybackToken error', e);
      return { anonymous: true };
    }
  }
  async getFollows(): Promise<any[]> {
    return this.getAllChannels();
  }
}

export function createTwitchService(): TwitchService {
  return new TwitchService();
}

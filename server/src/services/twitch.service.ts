import { prisma } from '../db/prisma.client';

const TWITCH_GQL = 'https://gql.twitch.tv/gql';
// Twitch's own web client-id (public, used by twitch.tv website)
const TWITCH_WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const GQL_HEADERS = {
  'Client-Id': TWITCH_WEB_CLIENT_ID,
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
};

async function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(TWITCH_GQL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GQL HTTP ${res.status}`);
  return res.json();
}

export class TwitchService {
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
      console.error('Save twitch follows error:', e);
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
      console.error('getFollowsByProfile error:', e);
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
      return this.getCachedStreams();
    }

    try {
      // Batch query: get all channels in one GQL call
      const logins = JSON.stringify(channels);
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
      `, { logins: channels });

      const users: any[] = data?.data?.users || [];
      const liveStreams = users
        .filter(u => u.stream !== null)
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

      // Also return offline channels with isLive: false for the follows list
      const allChannels = users.map(u => ({
        twitchId: u.id,
        title: u.stream?.title || '',
        thumbnailUrl: u.stream?.previewImageURL ||
          `https://static-cdn.jtvnw.net/previews-ttv/live_user_${u.login}-320x180.jpg`,
        viewerCount: u.stream?.viewersCount || 0,
        channelName: u.displayName,
        channelLogin: u.login,
        channelAvatar: u.profileImageURL,
        gameName: u.stream?.game?.name || '',
        isLive: !!u.stream,
        url: `https://twitch.tv/${u.login}`,
      }));

      // Cache live streams
      if (liveStreams.length > 0) {
        await this.cacheStreams(liveStreams);
      }

      return liveStreams;
    } catch (e) {
      console.error('getFollowedStreams GQL error:', e);
      return this.getCachedStreams();
    }
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
      console.error('getAllChannels error:', e);
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
          },
        });
      }
    } catch (e) {
      console.error('Cache streams error:', e);
    }
  }

  private async getCachedStreams(): Promise<any[]> {
    try {
      return await prisma.twitchStream.findMany({
        where: { isLive: true },
        take: 20,
        orderBy: { fetchedAt: 'desc' },
      });
    } catch {
      return [];
    }
  }

  /** Legacy OAuth methods - now no-ops since we use GQL */
  getAuthUrl(): string { return ''; }
  async exchangeCodeForTokens(_code: string): Promise<boolean> { return false; }
  async isConnected(): Promise<boolean> {
    const channels = await this.getFollowedChannels();
    return channels.length > 0;
  }
  async disconnect(): Promise<void> {
    await this.saveFollowedChannels([]);
  }
  async getFollows(): Promise<any[]> {
    return this.getAllChannels();
  }
}

export function createTwitchService(): TwitchService {
  return new TwitchService();
}

export const twitchService = createTwitchService();

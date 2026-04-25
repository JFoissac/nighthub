import { prisma } from '../db/prisma.client';
import Parser from 'rss-parser';

const rssParser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'NightHub/1.0' },
  customFields: {
    item: [['media:group', 'mediaGroup']],
  },
});

const YT_RSS_BASE = 'https://www.youtube.com/feeds/videos.xml';
const YT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export class YoutubeService {
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

  /** Save channel handles to preferences */
  async saveChannelHandles(handles: string[]): Promise<void> {
    const value = handles.map(h => h.trim()).filter(Boolean).join(',');
    try {
      const existing = await prisma.userPreference.findFirst();
      if (existing) {
        await prisma.userPreference.update({ where: { id: existing.id }, data: { youtubeChannels: value } });
      } else {
        await prisma.userPreference.create({ data: { youtubeChannels: value } });
      }
    } catch (e) {
      console.error('Save youtube channels error:', e);
    }
  }

  /** Resolve a YouTube channel handle (@name) or name to a channel ID */
  async resolveChannelId(handle: string): Promise<string | null> {
    try {
      const normalized = handle.startsWith('@') ? handle : `@${handle}`;
      const url = `https://www.youtube.com/${normalized}`;

      const response = await fetch(url, {
        headers: { 'User-Agent': YT_USER_AGENT },
      });

      if (!response.ok) return null;

      const html = await response.text();

      const match = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
      if (match) return match[1];

      const canonMatch = html.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/);
      if (canonMatch) return canonMatch[1];

      return null;
    } catch (e) {
      console.error(`Resolve channel ID error for ${handle}:`, e);
      return null;
    }
  }

  /** Get saved channel IDs from preferences (imported from Google Takeout) */
  async getChannelIds(): Promise<string[]> {
    try {
      const pref = await prisma.userPreference.findFirst();
      if (!(pref as any)?.youtubeChannelIds) return [];
      return (pref as any).youtubeChannelIds
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => /^UC[a-zA-Z0-9_-]{22}$/.test(s));
    } catch {
      return [];
    }
  }

  /** Save channel IDs to preferences */
  async saveChannelIds(ids: string[]): Promise<void> {
    const value = ids.filter(id => /^UC[a-zA-Z0-9_-]{22}$/.test(id)).join(',');
    try {
      const existing = await prisma.userPreference.findFirst();
      if (existing) {
        await prisma.userPreference.update({ where: { id: existing.id }, data: { youtubeChannelIds: value } });
      } else {
        await prisma.userPreference.create({ data: { youtubeChannelIds: value } });
      }
    } catch (e) {
      console.error('Save youtube channel IDs error:', e);
    }
  }

  /**
   * FAST: Return cached videos from DB (last 3 days, max 20).
   * If cache is empty (first run), triggers a background fetch without blocking.
   */
  async getLatestVideos(): Promise<any[]> {
    const cached = await this.getCachedVideos();
    if (cached.length === 0) {
      // First run or cache cleared — trigger background fetch without blocking caller
      setImmediate(() => this.fetchAndCacheLatestVideos().catch(console.error));
    }
    return cached;
  }

  /**
   * SLOW: Fetch all channels via RSS in parallel batches, save to DB.
   * Called by refresh jobs and cron. NOT called by getDashboardData.
   */
  async fetchAndCacheLatestVideos(): Promise<void> {
    const CONCURRENCY = 10;

    const handles = await this.getChannelHandles();
    const channelIds = await this.getChannelIds();

    // Merge: handles first, then IDs not already covered by handles
    const allSources = [
      ...handles,
      ...channelIds.filter(id => !handles.some(h => h === id)),
    ];

    if (allSources.length === 0) return;

    console.log(`[YouTube] Fetching ${allSources.length} channels with concurrency ${CONCURRENCY}...`);

    const allVideos: any[] = [];

    // Process in parallel batches
    for (let i = 0; i < allSources.length; i += CONCURRENCY) {
      const batch = allSources.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(handle => this.fetchChannelVideos(handle))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') allVideos.push(...r.value);
      }
    }

    allVideos.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    if (allVideos.length > 0) {
      await this.cacheVideos(allVideos.slice(0, 50));
      console.log(`[YouTube] Cached ${Math.min(allVideos.length, 50)} videos`);
    }
  }

  /** Fetch and process a single channel's RSS feed */
  private async fetchChannelVideos(handle: string): Promise<any[]> {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THREE_DAYS_MS;

    let channelId: string | null = null;

    if (handle.startsWith('UC') && handle.length > 20) {
      channelId = handle;
    } else {
      channelId = await this.resolveChannelId(handle);
      if (channelId) {
        // Persist resolved ID so it's not re-resolved on next refresh
        const existingIds = await this.getChannelIds();
        if (!existingIds.includes(channelId)) {
          await this.saveChannelIds([...existingIds, channelId]);
        }
      }
    }

    if (!channelId) return [];

    try {
      const feedUrl = `${YT_RSS_BASE}?channel_id=${channelId}`;
      const feed = await rssParser.parseURL(feedUrl);
      const channelName = feed.title || handle;

      const rawVideos = (feed.items || [])
        .slice(0, 10)
        .map((item: any) => {
          const videoId = item.id?.replace('yt:video:', '') || '';
          const mediaGroup = item.mediaGroup || {};
          const views = parseInt(
            mediaGroup?.['media:community']?.['media:statistics']?.['$']?.views || '0', 10
          );
          const pubDate = item.pubDate || item.isoDate || new Date().toISOString();
          return {
            youtubeId: videoId,
            title: item.title || 'No title',
            thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channelName,
            channelAvatar: `https://yt3.googleusercontent.com/ytc/${channelId}`,
            channelId,
            channelHandle: handle,
            duration: '',
            durationSeconds: 0,
            views,
            url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
            isNew: this.isRecent(pubDate),
            publishedAt: pubDate,
          };
        })
        .filter((v: any) => new Date(v.publishedAt).getTime() >= cutoff); // 3-day filter

      if (rawVideos.length === 0) return [];

      // Fetch durations from YouTube Data API v3 (optional — requires YOUTUBE_API_KEY)
      const videoIds = rawVideos.map((v: any) => v.youtubeId).filter(Boolean);
      const durationsMap = await this.fetchDurations(videoIds);

      return rawVideos
        .map((v: any) => {
          const iso = durationsMap.get(v.youtubeId) || '';
          return {
            ...v,
            duration: this.formatDuration(iso),
            durationSeconds: this.parseDurationSeconds(iso),
          };
        })
        .filter((v: any) => !this.isShort(v))
        .slice(0, 5);
    } catch (e) {
      console.error(`YouTube RSS error for ${handle}:`, e);
      return [];
    }
  }

  /** Batch-fetch video durations from YouTube Data API v3 */
  private async fetchDurations(videoIds: string[]): Promise<Map<string, string>> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey || apiKey === 'your_youtube_data_api_key' || !videoIds.length) {
      return new Map();
    }
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
        console.error('YouTube duration fetch error:', e);
      }
    }
    return durations;
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
            publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
          },
        });
      }
    } catch (e) {
      console.error('Cache videos error:', e);
    }
  }

  async getCachedVideos(): Promise<any[]> {
    try {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const [channelIds, channelHandles] = await Promise.all([
        this.getChannelIds(),
        this.getChannelHandles(),
      ]);

      if (channelIds.length === 0 && channelHandles.length === 0) return [];

      return await prisma.youtubeVideo.findMany({
        where: {
          publishedAt: { gte: threeDaysAgo },
          OR: [
            { channelId: { in: [...channelIds, ''] } },
            ...(channelHandles.length > 0 ? [{ channelHandle: { in: channelHandles } }] : []),
          ],
        },
        take: 20,
        orderBy: { publishedAt: 'desc' },
      });
    } catch {
      return [];
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

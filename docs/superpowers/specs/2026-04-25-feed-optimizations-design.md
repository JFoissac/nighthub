# Design: Feed Optimizations — YouTube, X/Nitter, RSS Popup

**Date**: 2026-04-25  
**Status**: Approved

---

## Context

NightHub shows YouTube videos, X/Nitter tweets, and AI blog RSS articles. Three problems to fix:

1. **YouTube** shows videos from channels no longer followed (stale cache bug) and old videos
2. **X/Nitter** is slow to load (live Nitter scraping on every request, no cache-first); tweets can't be opened in a new tab; no way to detect inactive accounts
3. **RSS** can only be added via raw URL textarea in settings — no discovery UX

---

## Feature 1: YouTube — Fix stale channel cache

### Root Cause

`getCachedVideos()` queries `YoutubeVideo` by date only (`publishedAt >= 3 days ago`). There is no `channelId` column, so removing a channel from preferences doesn't stop its videos from appearing for up to 3 days.

### Solution

Add `channelId String @default("")` to `YoutubeVideo` schema. Filter `getCachedVideos()` to only return videos whose `channelId` is in the current `youtubeChannelIds` preference.

Legacy rows (pre-migration, `channelId = ""`) are still included on first deploy via `channelId IN [...currentIds, ""]` to avoid a content gap.

### Files changed

- `server/prisma/schema.prisma` — add `channelId String @default("")` + `@@index([channelId])` to `YoutubeVideo`
- `server/src/services/youtube.service.ts` — add `channelId` to `fetchChannelVideos()` rawVideos map, add to `cacheVideos()` upsert data, rewrite `getCachedVideos()` to filter by current IDs

### Migration

```bash
cd server && npx prisma migrate dev --name add_channel_id_to_youtube_video
```

---

## Feature 2: X/Nitter — Cache-first + new tab + inactive detection

### 2a. Cache-first loading

**Problem**: Every call to `getTimeline()` makes N Nitter HTTP requests (one per account, ~2-3s each). With 25 accounts → 50-75s of blocking.

**Solution**: Return DB cache immediately. Trigger a background Nitter refresh only if cache is stale (>30 min based on latest `fetchedAt`).

- Add `isCacheStale(maxAgeMinutes = 30): Promise<boolean>` to `twitter.service.ts`
- Refactor `getTimeline()` → return cached immediately, call `refreshTimeline()` via `setImmediate` if stale
- Remove the `onProgress` callback from `getDashboardData()`'s call to `getTimeline()` in `aggregator.service.ts`

### 2b. Tweet opens in new tab

**Solution**: Add `twitterId?: string` to `TweetItem` interface. Wrap tweet card content in `<a [href]="tweetUrl()" target="_blank" rel="noopener noreferrer">`. The `twitterId` stored in DB is the Nitter RSS item link (a full URL), so it can be used directly as `href`.

### 2c. Inactive account auto-detection

**Solution**: Derive last-seen date per handle from existing `Tweet` table using `MAX(fetchedAt) GROUP BY authorHandle`. No schema change needed.

- New endpoint `GET /api/twitter/account-stats` returns `{ handle, lastSeen, inactive }[]`
- `inactive = true` if last seen >30 days ago or never fetched
- In settings-modal: load stats on open, show each account chip with last-seen date, highlight red if inactive, allow individual deletion

### Files changed

- `server/src/services/twitter.service.ts` — add `isCacheStale()`, refactor `getTimeline()` + extract `refreshTimeline()`
- `server/src/services/aggregator.service.ts` — remove `onProgress` from `getTimeline()` call
- `server/src/routes/api.routes.ts` — add `GET /twitter/account-stats`
- `src/app/models/index.ts` — add `twitterId?: string` to `TweetItem`
- `src/app/components/tweet/tweet-card.component.ts` — wrap in `<a>`, add `tweetUrl()` computed
- `src/app/services/api.service.ts` — add `getTwitterAccountStats()`, add `TwitterAccountStat` interface
- `src/app/components/settings-modal/settings-modal.component.ts` — add `twitterStats` signal, load on open, update chip template

---

## Feature 3: RSS Feed Auto-Detection Popup

### Problem

Adding a custom RSS feed requires knowing its URL and pasting it in a textarea. Users shouldn't need to hunt for RSS URLs.

### Solution

A "+" button in the AI BLOG section header opens a modal where the user pastes any site URL. The backend:
1. Fetches the URL, looks for `<link type="application/rss+xml">` in HTML
2. If not found, probes common paths: `/feed`, `/rss`, `/rss.xml`, `/feed.xml`, `/atom.xml`
3. Validates candidates by checking for `<rss>` or `<feed>` root in response
4. Returns discovered `feedUrl` or 404

Frontend shows the discovered URL and asks for confirmation. On confirm, appends to `customRssFeeds` preference and triggers a news refresh.

### Files changed

- `server/src/services/news.service.ts` — add `detectFeed(url)` + `validateFeedUrl(url)` methods
- `server/src/routes/api.routes.ts` — add `POST /sites/detect-feed`
- `src/app/services/api.service.ts` — add `detectFeed()`, add `refreshNews()`
- `src/app/components/rss-detect-modal/rss-detect-modal.component.ts` — **new standalone component**
- `src/app/pages/dashboard/dashboard.component.ts` — add "+" button in AI BLOG header, host modal, add `showRssDetect` signal + `onFeedAdded()` handler

---

## Data Flow: RSS Detection

```
User pastes URL → POST /api/sites/detect-feed
  → newsService.detectFeed(url)
    → fetch(url) → parse <link type=rss> from HTML
    → if found: validateFeedUrl() → return feedUrl
    → else: probe /feed, /rss, /rss.xml, /feed.xml, /atom.xml
    → validate each candidate → return first valid
    → if none: return 404
  → Frontend shows feedUrl + "Ajouter" button
  → User confirms → PATCH preferences.customRssFeeds
  → POST /refresh/news (background)
```

---

## Verification

1. **YouTube**: Add a channel, fetch videos, remove it from prefs → its videos should no longer appear on next page load
2. **X cache**: Load dashboard → tweets appear immediately from cache; check server logs to confirm background refresh fires
3. **X new tab**: Click a tweet → opens in new tab at correct URL
4. **Inactive accounts**: Set a handle's tweets to old `fetchedAt` in DB → settings shows red chip
5. **RSS popup**: Paste `https://blog.cloudflare.com` → app detects `https://blog.cloudflare.com/rss/` → add → appears in AI BLOG section after refresh

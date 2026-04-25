# NightHub Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve NightHub with YouTube duration-based Shorts filtering, Twitch push-panel layout, follow-extraction scripts for X and Twitch, and update all documentation.

**Architecture:** Five independent subsystems — (1) YouTube Data API v3 for duration fetching + display on video cards, (2) Twitch side panel becomes a CSS-push sidebar (no backdrop, shifts main content), (3) browser scripts for extracting follows from X and Twitch, (4) documentation sync. No DB migrations needed (duration field already exists in YoutubeVideo schema).

**Tech Stack:** Angular 21 signals, Express/Node.js, Prisma/SQLite, YouTube Data API v3, Twitch GQL, Chrome DevTools console scripts.

---

## Files modified/created

| File | Change |
|------|--------|
| `server/.env` | Add `YOUTUBE_API_KEY` |
| `server/src/services/youtube.service.ts` | Add `fetchDurations()`, `parseDurationSeconds()`, `formatDuration()`; update `isShort()` to check duration < 60s; store formatted duration |
| `src/app/components/video/video-card.component.ts` | Add duration overlay on thumbnail |
| `src/app/components/stream/stream-player-panel.component.ts` | Remove backdrop; change to sticky sidebar layout |
| `src/app/pages/dashboard/dashboard.component.ts` | Flex wrapper for push-panel layout |
| `scripts/x-follows.js` | Chrome console script: extract X follows |
| `scripts/twitch-follows.js` | Chrome console script: extract Twitch follows via GQL |
| `README.md`, `PROJECT-DOC.md`, `PLAN.md`, `SESSION-LOG.md` | Documentation sync |

---

## Task 1: YouTube Data API — fetch durations

**Files:**
- Modify: `server/.env`
- Modify: `server/src/services/youtube.service.ts`

- [ ] **Step 1: Add API key placeholder to .env**

Append to `server/.env`:

```
# YouTube Data API v3 (for video durations)
YOUTUBE_API_KEY=your_youtube_data_api_key
```

The user must replace `your_youtube_data_api_key` with a real key from https://console.cloud.google.com → YouTube Data API v3.

- [ ] **Step 2: Add duration helper methods to YoutubeService**

In `server/src/services/youtube.service.ts`, add three private methods before the `isShort()` method:

```typescript
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

/** Parse ISO 8601 duration string to total seconds (PT1H2M3S → 3723) */
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
```

- [ ] **Step 3: Update `isShort()` to check duration**

Replace the existing `isShort()` method:

```typescript
/** Detect YouTube Shorts: #shorts in title, /shorts/ in URL, or duration < 60s */
private isShort(video: any): boolean {
  const title = (video.title || '').toLowerCase();
  const url = (video.url || '').toLowerCase();
  const isHashShort = title.includes('#shorts') || title.includes('#short') || url.includes('/shorts/');
  const isDurationShort = video.durationSeconds > 0 && video.durationSeconds < 60;
  return isHashShort || isDurationShort;
}
```

- [ ] **Step 4: Update `getLatestVideos()` to attach durations and filter**

In the `getLatestVideos()` method, the current per-channel loop builds `videos` then calls `.filter((v: any) => !this.isShort(v)).slice(0, 5)`. Replace that block with:

```typescript
// Build raw videos list (remove the old .filter and .slice)
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
      duration: '',
      durationSeconds: 0,
      views,
      url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
      isNew: this.isRecent(pubDate),
      publishedAt: pubDate,
    };
  });

// Fetch durations from YouTube Data API
const videoIds = rawVideos.map((v: any) => v.youtubeId).filter(Boolean);
const durationsMap = await this.fetchDurations(videoIds);

const videos = rawVideos
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
```

Note: The full replacement for the channel-loop body (inside `for (const handle of allSources)`) should look like:

```typescript
let channelId: string | null = null;

if (handle.startsWith('UC') && handle.length > 20) {
  channelId = handle;
} else {
  channelId = await this.resolveChannelId(handle);
}

if (!channelId) {
  console.error(`Could not resolve channel ID for: ${handle}`);
  continue;
}

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
      duration: '',
      durationSeconds: 0,
      views,
      url: item.link || `https://www.youtube.com/watch?v=${videoId}`,
      isNew: this.isRecent(pubDate),
      publishedAt: pubDate,
    };
  });

const videoIds = rawVideos.map((v: any) => v.youtubeId).filter(Boolean);
const durationsMap = await this.fetchDurations(videoIds);

const videos = rawVideos
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

allVideos.push(...videos);
```

- [ ] **Step 5: Update `cacheVideos()` to store duration**

The `cacheVideos()` method already has `duration: v.duration || ''` in its `create` block but not in `update`. Add it to the `update` block:

```typescript
update: {
  title: v.title,
  thumbnailUrl: v.thumbnailUrl,
  channelName: v.channelName,
  channelAvatar: v.channelAvatar,
  duration: v.duration || '',       // ← add this line
  url: v.url,
  isNew: v.isNew,
  views: v.views || 0,
  publishedAt: v.publishedAt ? new Date(v.publishedAt) : undefined,
},
```

- [ ] **Step 6: TypeScript check**

```bash
cd /home/dev/nighthub/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors.

---

## Task 2: Duration overlay on video cards (frontend)

**Files:**
- Modify: `src/app/components/video/video-card.component.ts`

The `YoutubeVideo` model already has `duration: string`. We just need to display it as a bottom-right overlay on the thumbnail.

- [ ] **Step 1: Add duration overlay to thumbnail block**

In `video-card.component.ts`, the thumbnail `<div>` currently ends with the `isNew` badge. Add a duration badge right after it:

```html
<!-- Duration overlay (bottom right of thumbnail) -->
@if (video()!.duration) {
  <div class="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 font-mono text-[8px] text-white rounded leading-none">
    {{ video()!.duration }}
  </div>
}
```

The full thumbnail block should be:

```html
<div class="relative w-32 h-[72px] bg-[#1E1E2E] rounded overflow-hidden flex-shrink-0 border border-[#1E1E2E] group-hover:border-primary transition-colors">
  <img [src]="video()!.thumbnailUrl" [alt]="video()!.title"
       class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
  <!-- Play overlay -->
  <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
    <svg class="w-8 h-8 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  </div>
  @if (video()!.isNew) {
    <div class="absolute top-1 left-1 px-1 py-0.5 bg-primary text-[#0A0A0F] font-label-caps text-[7px] rounded">NEW</div>
  }
  @if (video()!.duration) {
    <div class="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 font-mono text-[8px] text-white rounded leading-none">
      {{ video()!.duration }}
    </div>
  }
</div>
```

- [ ] **Step 2: TypeScript check**

```bash
cd /home/dev/nighthub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: 0 errors.

---

## Task 3: Twitch panel — push layout (no backdrop)

**Files:**
- Modify: `src/app/components/stream/stream-player-panel.component.ts`
- Modify: `src/app/pages/dashboard/dashboard.component.ts`

Currently the panel uses `fixed inset-0 bg-black/40` (backdrop) + `fixed top-0 right-0 h-full` (panel). The goal is a sticky sidebar that pushes the dashboard left, with no backdrop.

- [ ] **Step 1: Rewrite stream-player-panel.component.ts template**

Replace the entire template (the `template: \`` content) in `stream-player-panel.component.ts`. The new template removes the backdrop and uses an `<aside>` with sticky positioning:

```typescript
template: `
  <!-- Sticky side panel — no backdrop, pushes dashboard left -->
  <aside class="w-[360px] xl:w-[420px] flex-shrink-0 h-[calc(100vh-3rem)] sticky top-12 border-l border-[#1E1E2E] bg-[#0e0e13] flex flex-col overflow-hidden shadow-[-8px_0_32px_rgba(0,0,0,0.4)]">

    <!-- Header -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-[#1E1E2E] bg-[#131318]/60 flex-shrink-0">
      <img
        [src]="stream().channelAvatar"
        [alt]="stream().channelName"
        class="w-8 h-8 rounded-full flex-shrink-0 border border-[#1E1E2E]"
      >
      <div class="min-w-0 flex-1">
        <p class="font-label-caps text-[11px] text-text-primary truncate">{{ stream().channelName }}</p>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="status-pulse status-pulse-red"></span>
          <span class="font-label-caps text-[9px] text-text-muted">LIVE</span>
          @if (stream().gameName) {
            <span class="font-label-caps text-[9px] text-text-muted">· {{ stream().gameName }}</span>
          }
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <a
          [href]="twitchUrl()"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 px-2 py-1 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded text-[9px] font-label-caps transition-colors border border-secondary/20"
          title="Ouvrir dans un onglet"
        >
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          ONGLET
        </a>
        <button
          (click)="close.emit()"
          class="p-1.5 rounded hover:bg-[#1E1E2E] transition-colors text-text-muted hover:text-text-primary"
          title="Fermer"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Stream title + stats -->
    <div class="px-4 py-2 border-b border-[#1E1E2E]/50 bg-[#131318]/40 flex-shrink-0">
      <p class="text-[13px] text-text-secondary line-clamp-1">{{ stream().title }}</p>
      <span class="font-label-caps text-[9px] text-text-muted">{{ stream().viewerCount | number }} VIEWERS</span>
    </div>

    <!-- Twitch Player -->
    <div class="flex-1 bg-black">
      <iframe
        [src]="playerUrl()"
        class="w-full h-full"
        allowfullscreen
        frameborder="0"
        allow="autoplay; fullscreen"
      ></iframe>
    </div>
  </aside>
`,
```

- [ ] **Step 2: Update dashboard.component.ts — flex wrapper layout**

In `dashboard.component.ts`, the outer template structure is:

```html
<div class="min-h-screen bg-background">
  <app-header ...></app-header>
  ...overlays (weather, settings, selectedVideo, panelVideo)...
  @if (selectedStream()) {
    <app-stream-player-panel [stream]="selectedStream()!" (close)="selectedStream.set(null)"></app-stream-player-panel>
  }
  <main class="pt-12 min-h-screen">
    ...
  </main>
</div>
```

Change it to (the stream panel moves inside a flex wrapper with `<main>`):

```html
<div class="min-h-screen bg-background">
  <app-header
    (refresh)="refreshAll()"
    (openSettings)="showSettings.set(true)"
    (openWeather)="showWeather.set(true)"
    [weatherTemp]="dashboardData()?.weather?.days?.[0]?.temp ?? null"
    [weatherCity]="dashboardData()?.weather?.city || ''"
    [weatherCondition]="dashboardData()?.weather?.days?.[0]?.condition || ''"
    [streamCount]="dashboardData()?.streams?.length || 0"
    [videoCount]="dashboardData()?.videos?.length || 0"
    [newsCount]="dashboardData()?.news?.length || 0"
    [tweetCount]="dashboardData()?.tweets?.length || 0"
  ></app-header>

  @if (showWeather()) {
    <app-weather-popup
      [forecast]="dashboardData()?.weather || null"
      (close)="showWeather.set(false)"
    ></app-weather-popup>
  }

  @if (showSettings()) {
    <app-settings-modal
      (close)="showSettings.set(false)"
      (saved)="onSettingsSaved()"
    ></app-settings-modal>
  }

  @if (selectedVideo()) {
    <app-video-player-popup
      [video]="selectedVideo()!"
      (close)="selectedVideo.set(null)"
      (openPanel)="selectedVideo.set(null); panelVideo.set($event)"
    ></app-video-player-popup>
  }

  @if (panelVideo()) {
    <app-video-player-panel
      [video]="panelVideo()!"
      (close)="panelVideo.set(null)"
    ></app-video-player-panel>
  }

  <!-- Push-panel flex layout: main content shrinks when stream panel is open -->
  <div class="flex pt-12 min-h-screen">
    <main class="flex-1 min-w-0">
      <div class="p-6 max-w-screen-2xl mx-auto">
        @if (isLoading()) {
          <div class="flex items-center justify-center py-20">
            <span class="font-label-caps text-[11px] text-text-muted animate-pulse">LOADING DASHBOARD...</span>
          </div>
        } @else {
          <!-- Top Row: Twitter (5-col) + YouTube (7-col) -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
            <!-- ... existing Twitter section (lg:col-span-5) ... -->
            <!-- ... existing YouTube section (lg:col-span-7) ... -->
          </div>

          <!-- Twitch Live Streams — full-width horizontal carousel -->
          <!-- ... existing streams section ... -->

          <!-- Bottom Row: AI Blog (6-col) + Trump Watch (6-col) -->
          <!-- ... existing bottom sections ... -->
        }
      </div>

      <footer class="text-center py-4 border-t border-[#1E1E2E]">
        <span class="font-label-caps text-[9px] text-text-muted">NIGHTHUB — TERMINAL DASHBOARD</span>
        @if (dashboardData()?.refreshedAt) {
          <span class="block mt-1 font-label-caps text-[9px] text-text-muted">LAST UPDATE: {{ dashboardData()!.refreshedAt | date:'short' }}</span>
        }
      </footer>
    </main>

    @if (selectedStream()) {
      <app-stream-player-panel
        [stream]="selectedStream()!"
        (close)="selectedStream.set(null)"
      ></app-stream-player-panel>
    }
  </div>
</div>
```

**Key changes:**
- Removed `pt-12` from `<main>` → moved to wrapper `<div class="flex pt-12 min-h-screen">`
- `<main>` gets `flex-1 min-w-0` (fills available space, allows shrinking)
- `<app-stream-player-panel>` moved inside the flex wrapper, after `<main>`
- Removed the standalone `@if (selectedStream())` block that was before `<main>`

- [ ] **Step 3: TypeScript check + build**

```bash
cd /home/dev/nighthub && npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -20
```

Expected: 0 errors.

```bash
cd /home/dev/nighthub && npx nx build 2>&1 | tail -10
```

Expected: `Successfully ran target build`

---

## Task 4: X follows extraction script

**Files:**
- Create: `scripts/x-follows.js`

- [ ] **Step 1: Create the script**

Create `scripts/x-follows.js`:

```javascript
/**
 * NightHub — Script d'extraction des follows X (Twitter)
 *
 * UTILISATION :
 * 1. Ouvrir https://x.com/{votre_pseudo}/following
 * 2. Attendre que la page soit chargée
 * 3. Coller ce script dans la console Chrome (F12 → Console)
 * 4. Le script scroll automatiquement (~30 sec)
 * 5. Les @handles sont copiés dans le presse-papier
 * 6. Coller dans NightHub Settings → Twitter → Accounts (séparés par virgule)
 */

(async () => {
  if (!window.location.pathname.includes('/following')) {
    console.error('[NightHub] Erreur : allez sur https://x.com/{votre_pseudo}/following avant de lancer ce script.');
    return;
  }

  console.log('[NightHub] Démarrage de l\'extraction des follows X...');

  // --- Étape 1 : Scroll pour charger tous les follows ---
  let prevCount = 0;
  let stable = 0;

  while (stable < 4) {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 1800));

    const cells = document.querySelectorAll('[data-testid="UserCell"]');
    if (cells.length === prevCount) {
      stable++;
    } else {
      stable = 0;
      prevCount = cells.length;
    }
    console.log(`[NightHub] Chargement... ${cells.length} comptes trouvés`);
  }

  // --- Étape 2 : Extraire les handles ---
  const cells = Array.from(document.querySelectorAll('[data-testid="UserCell"]'));
  const handles = new Set();

  for (const cell of cells) {
    // Le handle (@pseudo) est dans un <span> ou <div> qui commence par @
    const allText = cell.querySelectorAll('span, div');
    for (const el of allText) {
      const text = el.textContent?.trim() || '';
      if (text.startsWith('@') && text.length > 1 && text.length < 50 && !text.includes(' ')) {
        handles.add(text);
        break;
      }
    }
  }

  if (handles.size === 0) {
    // Fallback: chercher les liens de profil
    const profileLinks = document.querySelectorAll('a[href^="/"][role="link"]');
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/([a-zA-Z0-9_]{1,15})$/);
      if (match && !['home', 'explore', 'notifications', 'messages', 'search'].includes(match[1])) {
        handles.add(`@${match[1]}`);
      }
    }
  }

  if (handles.size === 0) {
    console.error('[NightHub] Aucun compte trouvé. Assurez-vous d\'être sur la page /following de votre compte.');
    return;
  }

  const csv = [...handles].join(',');

  // --- Étape 3 : Copier dans le presse-papier ---
  try {
    await navigator.clipboard.writeText(csv);
    console.log('%c[NightHub] ✅ Handles copiés dans le presse-papier !', 'color: #34D399; font-weight: bold');
  } catch (e) {
    console.warn('[NightHub] Impossible de copier automatiquement. Copiez manuellement ci-dessous.');
  }

  console.log(`%c[NightHub] ${handles.size} comptes extraits`, 'color: #c0c1ff; font-weight: bold; font-size: 14px');
  console.log('');
  console.log('%cIMPORT dans NightHub :', 'color: #5de6ff; font-weight: bold');
  console.log('  1. Ouvrir NightHub → Settings (⚙) → Twitter');
  console.log('  2. Coller dans le champ "Twitter Accounts" (séparés par virgule)');
  console.log('');
  console.log('%cHandles :', 'color: #908fa0');
  console.log(csv);

  return { handles: [...handles], csv };
})();
```

---

## Task 5: Twitch follows extraction script

**Files:**
- Create: `scripts/twitch-follows.js`

- [ ] **Step 1: Create the script**

Create `scripts/twitch-follows.js`:

```javascript
/**
 * NightHub — Script d'extraction des follows Twitch
 *
 * UTILISATION :
 * 1. Être connecté sur https://www.twitch.tv
 * 2. Ouvrir la console Chrome (F12 → Console)
 * 3. Coller ce script
 * 4. Les logins des chaînes sont copiés dans le presse-papier
 * 5. Coller dans NightHub Settings → Twitch → Follows (séparés par virgule)
 *
 * Méthode : utilise le même endpoint GQL public que le site Twitch.
 * Requiert d'être connecté (lit le auth-token depuis les cookies).
 */

(async () => {
  console.log('[NightHub] Démarrage de l\'extraction des follows Twitch...');

  const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

  // Lire le token d'authentification depuis les cookies
  const authToken = document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('auth-token='))
    ?.split('=')?.[1];

  if (!authToken) {
    console.error('[NightHub] Non connecté à Twitch. Connectez-vous sur twitch.tv avant de lancer ce script.');
    return;
  }

  const gqlHeaders = {
    'Client-Id': CLIENT_ID,
    'Content-Type': 'application/json',
    'Authorization': `OAuth ${authToken}`,
  };

  // Récupérer l'utilisateur courant
  const meRes = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: gqlHeaders,
    body: JSON.stringify({ query: 'query { currentUser { id login displayName } }' }),
  });

  const meData = await meRes.json();
  const me = meData?.data?.currentUser;

  if (!me) {
    console.error('[NightHub] Impossible de récupérer le profil utilisateur. Essayez de vous reconnecter.');
    return;
  }

  console.log(`[NightHub] Connecté en tant que : ${me.displayName} (${me.login})`);

  // Récupérer tous les follows avec pagination
  const channels = [];
  let cursor = null;

  do {
    const query = `query GetFollows($userId: ID!, $after: Cursor) {
      user(id: $userId) {
        follows(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          edges { node { id login displayName } }
        }
      }
    }`;

    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: gqlHeaders,
      body: JSON.stringify({ query, variables: { userId: me.id, after: cursor } }),
    });

    const data = await res.json();
    const follows = data?.data?.user?.follows;

    if (!follows) {
      console.error('[NightHub] Erreur lors de la récupération des follows. Réponse GQL:', JSON.stringify(data));
      break;
    }

    const edges = follows.edges || [];
    channels.push(...edges.map(e => e.node.login));

    console.log(`[NightHub] ${channels.length} follows chargés...`);

    cursor = follows.pageInfo?.hasNextPage ? follows.pageInfo.endCursor : null;
    if (cursor) await new Promise(r => setTimeout(r, 300));

  } while (cursor);

  if (channels.length === 0) {
    console.warn('[NightHub] Aucun follow trouvé.');
    return;
  }

  const csv = channels.join(',');

  // Copier dans le presse-papier
  try {
    await navigator.clipboard.writeText(csv);
    console.log('%c[NightHub] ✅ Follows copiés dans le presse-papier !', 'color: #34D399; font-weight: bold');
  } catch (e) {
    console.warn('[NightHub] Impossible de copier automatiquement. Copiez manuellement ci-dessous.');
  }

  console.log(`%c[NightHub] ${channels.length} follows extraits`, 'color: #c0c1ff; font-weight: bold; font-size: 14px');
  console.log('');
  console.log('%cIMPORT dans NightHub :', 'color: #5de6ff; font-weight: bold');
  console.log('  1. Ouvrir NightHub → Settings (⚙) → Twitch');
  console.log('  2. Coller dans "Twitch Channels" et cliquer Sauvegarder');
  console.log('');
  console.log('%cChannels :', 'color: #908fa0');
  console.log(csv);

  return { channels, csv };
})();
```

---

## Task 6: Documentation sync

**Files:**
- Modify: `README.md`
- Modify: `PROJECT-DOC.md`
- Modify: `PLAN.md`
- Modify: `SESSION-LOG.md`

- [ ] **Step 1: Update SESSION-LOG.md**

Append to `SESSION-LOG.md`:

```markdown

---

## Session du 25 avril 2026 (suite)

### 5. YouTube — Durée des vidéos et filtrage amélioré des Shorts

- **Backend** (`server/src/services/youtube.service.ts`) :
  - Ajout de `fetchDurations()` : appel batch à YouTube Data API v3 (`videos?part=contentDetails`) pour chaque lot de 50 IDs
  - Ajout de `parseDurationSeconds()` : parsing ISO 8601 (PT#H#M#S) → secondes
  - Ajout de `formatDuration()` : formattage pour affichage (ex: "12:34", "1:05:03")
  - `isShort()` amélioré : filtre aussi les vidéos < 60 secondes (en plus des heuristiques #shorts)
  - Durée stockée dans la DB (champ `duration` déjà existant dans `YoutubeVideo`)
- **Frontend** (`src/app/components/video/video-card.component.ts`) :
  - Overlay durée en bas à droite de la vignette (style YouTube)
- **Config** : ajouter `YOUTUBE_API_KEY` dans `server/.env`

### 6. Twitch — Side panel sans backdrop (push layout)

- **`stream-player-panel.component.ts`** : suppression du backdrop noir, panel devient un `<aside>` sticky (`sticky top-12 h-[calc(100vh-3rem)]`)
- **`dashboard.component.ts`** : wrapper `<div class="flex pt-12">` autour de `<main>` + panel → dashboard pousse à gauche sans masquer le contenu

### 7. Scripts d'extraction

- **`scripts/x-follows.js`** : scroll automatique sur `x.com/{user}/following`, extrait les @handles, copie en CSV
- **`scripts/twitch-follows.js`** : utilise le GQL Twitch (auth-token cookie), récupère tous les follows paginés, copie les logins en CSV
```

- [ ] **Step 2: Update PLAN.md status section**

Add a "Completed" section at the top of `PLAN.md` (or update any existing status):

```markdown
## Statut — 25 avril 2026

### ✅ Complété
- Design system Neo-Noir Terminal (Stitch) appliqué
- Header fixe avec météo, stats, status LEDs
- Popup météo 7 jours
- YouTube Recap : vignettes, vues, date relative, popup + side panel vidéo
- Script extraction abonnements YouTube (`scripts/youtube-subscriptions.js`)
- Flux RSS personnalisés
- Filtre Shorts par durée (YouTube Data API v3) + affichage durée
- Twitch side panel push (sans backdrop)
- Script extraction follows X (`scripts/x-follows.js`)
- Script extraction follows Twitch (`scripts/twitch-follows.js`)

### 🔄 Connu / Limites
- Durée YouTube nécessite `YOUTUBE_API_KEY` (clé API v3 Google Console)
- Nitter peut retourner 429 (rate limit) → fallback cache
- Avatars Twitter = URLs génériques (API X payante)
```

- [ ] **Step 3: Update README.md**

Update the scripts section in `README.md` to list all three extraction scripts. Find the scripts section (or add one) with:

```markdown
## Scripts utilitaires

| Script | Usage |
|--------|-------|
| `scripts/youtube-subscriptions.js` | Extraire vos abonnements YouTube depuis `youtube.com/feed/channels` |
| `scripts/x-follows.js` | Extraire vos follows X depuis `x.com/{pseudo}/following` |
| `scripts/twitch-follows.js` | Extraire vos follows Twitch (GQL, requiert d'être connecté) |

Pour chaque script : ouvrir la console Chrome (F12), coller le contenu, patienter. Le résultat est copié automatiquement dans le presse-papier.
```

- [ ] **Step 4: Update PROJECT-DOC.md features section**

Find the "Features" or "Architecture" section in `PROJECT-DOC.md` and update the YouTube + Twitch entries to reflect the current state:

- YouTube: RSS + Data API v3 pour durées, filtre Shorts (titre + durée < 60s), affichage durée sur vignettes
- Twitch: GQL public, side panel push (pas de backdrop), viewer count + gameName affichés

---

## Verification finale

- [ ] **Build propre**

```bash
cd /home/dev/nighthub && npx nx build 2>&1 | tail -5
```

Expected: `Successfully ran target build for project nighthub`

- [ ] **Vérification manuelle (serveur dev)**

```bash
cd /home/dev/nighthub && npx nx serve &
```

Vérifier :
- Bloc YouTube : vignette avec durée en overlay bas-droite, pas de Shorts (< 60s)
- Cliquer un stream Twitch : panel s'ouvre à droite, dashboard reste navigable, pas de fond sombre
- Fermer avec la touche Échap ou le bouton ×

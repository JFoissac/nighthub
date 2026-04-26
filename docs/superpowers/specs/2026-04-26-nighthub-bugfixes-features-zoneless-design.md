# Nighthub — Bug Fixes, Features & Zoneless Migration

**Date** : 2026-04-26
**Scope** : 4 bug fixes, 1 feature, 1 migration
**Executor** : Sonnet (pas de liberties, suivre ce spec exactement)

---

## Contexte

Nighthub est un dashboard personnel Angular 21 + Express + SQLite/Prisma. YouTube est passé en RSS, X/Nitter est abandonné. Plusieurs bugs sont apparus suite à la migration RSS, et des features manquent (lazy loading universel, popup streams). L'app doit aussi migrer vers le mode zoneless d'Angular 21.

---

## 1. Bug Fix — Lives YouTube terminés s'affichent encore

### Cause racine

`isLiveStream()` dans `server/src/services/youtube.service.ts:388` détecte les lives par mots-clés dans le titre (`/\b(live|en direct|🔴|premiere|première)\b/`). Une fois `isLive: true` stocké en DB via `cacheVideos()`, il n'est jamais remis à `false` quand le live se termine.

### Solution

Ajouter une vérification active du statut live via Piped (gratuit, sans API key).

### Fichiers à modifier

**`server/src/services/youtube.service.ts`** :

Ajouter la méthode suivante après `getCachedLiveStreams()` :

```typescript
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

  console.log(`[YouTube] Verifying ${liveVideos.length} live streams...`);

  const instanceUrl = config.piped.instanceUrl;

  for (const video of liveVideos) {
    try {
      let stillLive = false;

      if (instanceUrl) {
        // Piped: /streams/{videoId} returns { livestream: boolean }
        const url = `${instanceUrl.replace(/\/$/, '')}/streams/${video.youtubeId}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': YT_USER_AGENT },
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data = await res.json();
          stillLive = data.livestream === true;
        }
      } else {
        // Fallback: YouTube oEmbed — if video is no longer live, 
        // the title in oEmbed won't contain live keywords
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${video.youtubeId}&format=json`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          stillLive = this.isLiveStream(data.title || '');
        }
        // If oEmbed fails (404 = video removed/private), mark as not live
      }

      if (!stillLive) {
        await prisma.youtubeVideo.update({
          where: { id: video.id },
          data: { isLive: false },
        });
        console.log(`[YouTube] Live ended: ${video.youtubeId}`);
      }
    } catch (e) {
      // On error, leave isLive unchanged (conservative)
      console.warn(`[YouTube] Failed to verify live status for ${video.youtubeId}:`, e);
    }
  }
}
```

**`server/src/services/aggregator.service.ts`** :

Ajouter un cron job toutes les 5 minutes pour vérifier les lives :

```typescript
// Dans initCronJobs(), ajouter après le cron Twitch :
cron.schedule('*/5 * * * *', () => {
  console.log('[Cron] Verifying YouTube live streams...');
  youtubeService.verifyAndCleanLiveStreams().catch(console.error);
});
```

---

## 2. Bug Fix — Chaînes YouTube non suivies (Citronverse)

### Cause racine

`youtubeChannelIds` peut contenir des IDs orphelins (importés via Google Takeout) qui ne correspondent à aucun handle dans `youtubeChannels`. `getCachedVideos()` filtre par `channelId IN (...)` OR `channelHandle IN (...)`, donc ces IDs orphelins font remonter des vidéos.

### Solution

Synchroniser `youtubeChannelIds` avec `youtubeChannels` (les handles sont la source de vérité). Nettoyer les vidéos orphelines.

### Fichiers à modifier

**`server/src/services/youtube.service.ts`** :

Ajouter après `saveChannelIds()` :

```typescript
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
      console.log('[YouTube] No handles configured, cleared all cached videos');
      return;
    }

    // Resolve current handles to IDs
    const resolved = await Promise.all(handles.map(h => this.resolveChannelId(h)));
    const validIds = resolved.filter((id): id is string => id !== null);

    // Get stored IDs
    const storedIds = await this.getChannelIds();

    // Find orphan IDs (in stored but not in resolved)
    const orphanIds = storedIds.filter(id => !validIds.includes(id));

    if (orphanIds.length > 0) {
      console.log(`[YouTube] Removing ${orphanIds.length} orphan channel IDs:`, orphanIds);

      // Delete cached videos from orphan channels
      await prisma.youtubeVideo.deleteMany({
        where: { channelId: { in: orphanIds } },
      });

      // Update stored IDs to only valid ones
      await this.saveChannelIds(validIds);
    }
  } catch (e) {
    console.error('[YouTube] Clean orphan channel IDs error:', e);
  }
}
```

**`server/src/app.ts`** :

Appeler le nettoyage au démarrage, après l'initialisation Prisma :

```typescript
// Après prisma.$connect() ou au démarrage :
youtubeService.cleanOrphanChannelIds().catch(console.error);
```

Note : `saveChannelHandles()` appelle déjà `saveChannelIds(validIds)` (ligne 46), ce qui est correct. Mais `cleanOrphanChannelIds()` ajoute la suppression des vidéos orphelines en DB. Appeler `cleanOrphanChannelIds()` aussi à la fin de `saveChannelHandles()` après le `saveChannelIds()`.

---

## 3. Bug Fix — RSS pas rafraîchi + tri par date

### Cause racine

1. `onFeedAdded()` dans `dashboard.component.ts:403` sauvegarde les prefs et appelle `refreshNews()` mais ne recharge jamais le dashboard → la vue reste figée
2. L'aggregator applique `sortByRelevance()` aux news (ligne 173), ce qui override le tri chronologique

### Solution

Recharger le dashboard après ajout de feed. Tri par date par défaut avec toggle pour basculer en pertinence.

### Fichiers à modifier

**`src/app/pages/dashboard/dashboard.component.ts`** :

Remplacer `onFeedAdded()` :

```typescript
onFeedAdded(feedUrl: string) {
  this.showRssDetect.set(false);
  this.apiService.getPreferences().subscribe({
    next: (prefs) => {
      const existing = (prefs.customRssFeeds || '').trim();
      const updated = existing ? `${existing}\n${feedUrl}` : feedUrl;
      this.apiService.savePreferences({ customRssFeeds: updated }).subscribe({
        next: () => {
          // Refresh news then reload dashboard to show new articles
          this.apiService.refreshNews().subscribe({
            next: () => this.loadDashboard(),
            error: () => this.loadDashboard(), // reload even on error
          });
        },
      });
    },
  });
}
```

Ajouter le signal de tri et le computed pour les news triées :

```typescript
import { computed } from '@angular/core';

// Signals
newsSortMode = signal<'date' | 'relevance'>('date');

// Computed
sortedNews = computed(() => {
  const news = this.dashboardData()?.news || [];
  if (this.newsSortMode() === 'date') {
    return [...news].sort((a, b) =>
      new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
    );
  }
  return news; // already sorted by relevance from backend
});
```

Dans le template du bloc AI Blog, remplacer `dashboardData()?.news` par `sortedNews()` dans le `@for`. Ajouter un bouton toggle dans le header du bloc :

```html
<button
  (click)="newsSortMode.set(newsSortMode() === 'date' ? 'relevance' : 'date')"
  class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors"
  [title]="newsSortMode() === 'date' ? 'Tri par pertinence' : 'Tri par date'"
>
  @if (newsSortMode() === 'date') {
    <!-- Calendar icon = currently sorted by date -->
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  } @else {
    <!-- Star icon = currently sorted by relevance -->
    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  }
</button>
```

**`server/src/services/aggregator.service.ts`** :

Ligne 173, ne plus appeler `sortByRelevance` sur les news :

```typescript
// Avant :
news: news.status === 'fulfilled' ? this.sortByRelevance(news.value, 'news') : [],
// Après :
news: news.status === 'fulfilled' ? news.value : [],
```

Les news de `getCachedNews()` sont déjà triées par `pubDate desc` (line 251 de news.service.ts). Le tri par relevance sera fait côté frontend si l'utilisateur bascule.

---

## 4. Bug Fix + Feature — Lazy loading universel

### Cause racine du bug

`initVideoLazyLoading()` s'exécute 1s après `ngOnInit` via `setTimeout`. À ce moment le dashboard charge encore via SSE → le container `#video-scroll-container` n'existe pas → le listener n'est jamais attaché. De plus `isScrollable` check empêche l'attachement si le contenu initial ne déborde pas.

### Solution

Remplacer par une directive `IntersectionObserver` réutilisable, appliquée aux 4 blocs scrollables.

### Fichier à créer

**`src/app/directives/infinite-scroll.directive.ts`** :

```typescript
import {
  Directive,
  ElementRef,
  OnInit,
  OnDestroy,
  output,
  input,
} from '@angular/core';

@Directive({
  selector: '[appInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  /** When true, the observer ignores intersections (e.g. during loading) */
  disabled = input(false);

  /** Emitted when the host element becomes visible in its scroll container */
  scrolledToEnd = output<void>();

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !this.disabled()) {
          this.scrolledToEnd.emit();
        }
      },
      {
        // Use null = viewport-based observation.
        // The sentinel is inside a scrollable container (overflow-y-auto via Tailwind).
        // IntersectionObserver with root: null still fires when the element
        // scrolls into the visible viewport area within its scroll container.
        // Alternative: pass the scroll container as root via an input if needed.
        threshold: 0.1,
      }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.observer = null;
  }
}
```

### Fichier à modifier

**`src/app/pages/dashboard/dashboard.component.ts`** :

1. **Supprimer** : `initVideoLazyLoading()`, l'appel dans `ngOnInit`, et le `#video-scroll-sentinel` existant.

2. **Ajouter** les imports :
```typescript
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
```
Ajouter `InfiniteScrollDirective` dans le tableau `imports`.

3. **Ajouter les signals** pour chaque bloc :
```typescript
// Lazy loading — existants (garder videoLimit, isLoadingMoreVideos)
// Ajouter :
newsLimit = signal(20);
isLoadingMoreNews = signal(false);
trumpLimit = signal(20);
isLoadingMoreTrump = signal(false);
tweetLimit = signal(20);
isLoadingMoreTweets = signal(false);
readonly maxLimit = 100;
```

4. **Ajouter les méthodes** `loadMore{Bloc}()` sur le même pattern que `loadMoreVideos()` :

```typescript
loadMoreNews() {
  const current = this.newsLimit();
  const next = Math.min(current + 20, this.maxLimit);
  if (next === current) return;
  this.isLoadingMoreNews.set(true);
  this.apiService.getNews(next).subscribe({
    next: (news) => {
      const data = this.dashboardData();
      if (data) this.dashboardData.set({ ...data, news });
      this.newsLimit.set(next);
      this.isLoadingMoreNews.set(false);
    },
    error: () => this.isLoadingMoreNews.set(false),
  });
}

loadMoreTrump() {
  const current = this.trumpLimit();
  const next = Math.min(current + 20, this.maxLimit);
  if (next === current) return;
  this.isLoadingMoreTrump.set(true);
  this.apiService.getTrumpTweets(next).subscribe({
    next: (trump) => {
      const data = this.dashboardData();
      if (data) this.dashboardData.set({ ...data, trump });
      this.trumpLimit.set(next);
      this.isLoadingMoreTrump.set(false);
    },
    error: () => this.isLoadingMoreTrump.set(false),
  });
}
```

5. **Modifier le template** de chaque bloc scrollable. Pattern pour chaque bloc :

**Header du bloc** — ajouter le spinner de chargement :
```html
<!-- Ajouter dans le header, à côté du titre -->
@if (isLoadingMore{Bloc}()) {
  <svg class="w-3.5 h-3.5 animate-spin text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
  </svg>
}
```

**Bas de la liste** — remplacer le sentinel existant par la directive :
```html
<!-- En bas de chaque @for, avant le @if empty -->
<div
  appInfiniteScroll
  [disabled]="isLoadingMore{Bloc}()"
  (scrolledToEnd)="loadMore{Bloc}()"
  class="h-1"
></div>
@if (isLoadingMore{Bloc}()) {
  <div class="text-center py-2">
    <span class="font-label-caps text-[9px] text-text-muted animate-pulse">LOADING...</span>
  </div>
}
```

6. **Réinitialiser les limits** dans `loadDashboard()` quand le dashboard se recharge :
```typescript
// Dans loadDashboard(), après les resets existants :
this.newsLimit.set(20);
this.trumpLimit.set(20);
this.tweetLimit.set(20);
this.isLoadingMoreNews.set(false);
this.isLoadingMoreTrump.set(false);
this.isLoadingMoreTweets.set(false);
```

7. **Supprimer** les appels `this.cdr.detectChanges()` dans `loadMoreVideos()` (inutile avec signals + zoneless).

---

## 5. Feature — Popup liste des streams en cours

### Fichier à créer

**`src/app/components/stream/stream-list-popup.component.ts`** :

```typescript
import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwitchStream } from '../../models';

@Component({
  selector: 'app-stream-list-popup',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" (click)="close.emit()"></div>

      <!-- Modal -->
      <div class="relative z-10 w-full max-w-lg mx-4 neo-glass rounded-lg overflow-hidden max-h-[80vh] flex flex-col">
        <!-- Header -->
        <div class="px-4 py-3 border-b border-[#1E1E2E] flex items-center justify-between bg-[#131318]/40 flex-shrink-0">
          <div class="flex items-center gap-2">
            <span class="status-pulse"></span>
            <span class="font-label-caps text-[11px] tracking-widest text-on-surface-variant">LIVE STREAMS</span>
            <span class="font-label-caps text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{{ streams().length }}</span>
          </div>
          <button (click)="close.emit()" class="w-6 h-6 flex items-center justify-center rounded hover:bg-[#1E1E2E] text-text-muted hover:text-primary transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Stream list -->
        <div class="flex-1 overflow-y-auto">
          @for (stream of streams(); track stream.twitchId || stream.id) {
            <button
              (click)="selectStream.emit(stream)"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1E1E2E]/60 transition-colors border-b border-[#1E1E2E]/30"
            >
              <img [src]="stream.thumbnailUrl" [alt]="stream.channelName" class="w-16 h-10 object-cover rounded" />
              <div class="flex-1 min-w-0 text-left">
                <p class="font-label-caps text-[10px] text-on-surface-variant truncate">{{ stream.channelName }}</p>
                <p class="text-[10px] text-text-muted truncate">{{ stream.title }}</p>
              </div>
              <div class="flex flex-col items-end gap-1 flex-shrink-0">
                <span class="font-label-caps text-[8px] px-1 py-0.5 rounded"
                  [class]="stream.gameName === 'YouTube Live' ? 'bg-red-500/20 text-red-400' : 'bg-secondary/20 text-secondary'">
                  {{ stream.gameName === 'YouTube Live' ? 'YOUTUBE' : 'TWITCH' }}
                </span>
                @if (stream.viewerCount) {
                  <span class="font-label-caps text-[8px] text-text-muted">{{ stream.viewerCount }} viewers</span>
                }
              </div>
            </button>
          }
          @if (!streams().length) {
            <div class="p-6 text-center">
              <p class="font-label-caps text-[10px] text-text-muted">NO STREAMS LIVE</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class StreamListPopupComponent {
  streams = input.required<TwitchStream[]>();
  close = output<void>();
  selectStream = output<TwitchStream>();
}
```

### Fichiers à modifier

**`src/app/components/header/header.component.ts`** :

Ajouter un output au clic sur le badge live count :

```typescript
openStreamList = output<void>();
```

Rendre le badge cliquable :
```html
<!-- Trouver le badge streamCount et wrapper dans un button -->
<button (click)="openStreamList.emit()" class="...existing classes..." title="Voir les streams en cours">
  <!-- existing live count content -->
</button>
```

**`src/app/pages/dashboard/dashboard.component.ts`** :

Ajouter :
```typescript
import { StreamListPopupComponent } from '../../components/stream/stream-list-popup.component';

// Dans imports: [..., StreamListPopupComponent]

// Signal
showStreamList = signal(false);
```

Dans le template, après les autres modals :
```html
@if (showStreamList()) {
  <app-stream-list-popup
    [streams]="dashboardData()?.streams || []"
    (close)="showStreamList.set(false)"
    (selectStream)="showStreamList.set(false); onStreamSelect($event)"
  ></app-stream-list-popup>
}
```

Dans le header component binding :
```html
(openStreamList)="showStreamList.set(true)"
```

Dans `onEscape()`, ajouter en premier :
```typescript
if (this.showStreamList()) { this.showStreamList.set(false); return; }
```

---

## 6. Migration Zoneless

### Fichiers à modifier

**`src/app/app.config.ts`** :

```typescript
import { provideZonelessChangeDetection } from '@angular/core';
// Note: en Angular 21, c'est probablement provideZonelessChangeDetection()
// Si pas disponible, utiliser provideExperimentalZonelessChangeDetection()

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(), // AJOUTER
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
  ],
};
```

**`package.json`** :

Retirer de devDependencies :
```
"zone.js": "~0.15.0"  // SUPPRIMER cette ligne
```

Puis exécuter `pnpm install`.

**`src/app/services/api.service.ts`** :

Supprimer l'injection de `NgZone`. Les callbacks EventSource (SSE) dans `getDashboardStream()` : supprimer les wrappers `this.ngZone.run(() => ...)` et laisser les appels directs. Les signaux déclenchent le change detection automatiquement en mode zoneless.

Avant :
```typescript
this.ngZone.run(() => {
  observer.next(data);
});
```

Après :
```typescript
observer.next(data);
```

**`src/app/components/header/header.component.ts`** :

Remplacer le `setInterval` avec property-based state :

Avant :
```typescript
time = new Date();
// dans ngOnInit ou constructor :
setInterval(() => { this.time = new Date(); }, 1000);
```

Après :
```typescript
time = signal(new Date());
private intervalId: any;
// dans ngOnInit :
this.intervalId = setInterval(() => this.time.set(new Date()), 1000);
// dans ngOnDestroy :
clearInterval(this.intervalId);
```

Mettre à jour le template pour utiliser `time()` au lieu de `time`.

**`src/app/pages/dashboard/dashboard.component.ts`** :

- Supprimer l'import et l'injection de `ChangeDetectorRef` (plus nécessaire grâce aux signaux)
- Supprimer tous les appels `this.cdr.detectChanges()` (déjà couverts par les sections précédentes)

**Nettoyage final** :

Vérifier qu'aucun fichier n'importe `NgZone` ou `zone.js` :
```bash
pnpm nx build nighthub
grep -r "NgZone\|zone\.js" src/ --include="*.ts" -l
```

---

## Ordre d'exécution recommandé

1. **Directive InfiniteScroll** (section 4) — créer le fichier, pas de dépendance
2. **Bug Citronverse** (section 2) — backend, indépendant
3. **Bug Lives terminés** (section 1) — backend, indépendant
4. **Bug RSS + tri** (section 3) — frontend + backend
5. **Lazy loading universel** (section 4) — frontend, utilise la directive du step 1
6. **Popup streams** (section 5) — frontend, indépendant
7. **Migration zoneless** (section 6) — en dernier, touche config globale

---

## Vérification

### Build & tests
```bash
pnpm nx build nighthub
pnpm nx test nighthub
```

### Tests manuels
- [ ] Dashboard se charge correctement via SSE
- [ ] Les lives YouTube terminés disparaissent (attendre le cron 5min ou forcer)
- [ ] Aucune vidéo de chaîne non-suivie n'apparaît
- [ ] Ajouter un flux RSS → la liste se rafraîchit avec les nouveaux articles
- [ ] Les articles sont triés par date par défaut
- [ ] Le toggle date/pertinence fonctionne dans AI Blog
- [ ] Scroll en bas du bloc YouTube → charge plus de vidéos avec spinner dans le header
- [ ] Scroll en bas du bloc AI Blog → charge plus d'articles
- [ ] Scroll en bas du bloc Trump Watch → charge plus de tweets
- [ ] Clic sur le compteur de lives dans le header → popup avec liste des streams
- [ ] Clic sur un stream dans la popup → ouvre le player
- [ ] Escape ferme la popup
- [ ] L'horloge du header se met à jour chaque seconde
- [ ] Le progress bar SSE fonctionne
- [ ] Le refresh global fonctionne
- [ ] Les modals s'ouvrent et se ferment correctement

### Fichiers créés (2)
- `src/app/directives/infinite-scroll.directive.ts`
- `src/app/components/stream/stream-list-popup.component.ts`

### Fichiers modifiés (9)
- `server/src/services/youtube.service.ts`
- `server/src/services/aggregator.service.ts`
- `server/src/services/news.service.ts`
- `server/src/routes/api.routes.ts`
- `server/src/app.ts`
- `src/app/pages/dashboard/dashboard.component.ts`
- `src/app/components/header/header.component.ts`
- `src/app/app.config.ts`
- `package.json`

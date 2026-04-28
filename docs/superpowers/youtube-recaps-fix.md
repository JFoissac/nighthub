# YouTube Recaps - Problèmes et Solutions

**Date:** 2026-04-28
**Statut:** Résolu

---

## Problèmes identifiés

### 1. Mismatch channelHandle / channelName

**Symptôme:** Quand un utilisateur suit `@MrGreatStephan`, les vidéos récupérées viennent de la chaîne "SEROTHS" (channelName). En base, `channelHandle = '@MrGreatStephan'` mais `channelName = 'SEROTHS'`.

**Cause racine:** `fetchChannelVideos()` reçoit le handle d'entrée (`@MrGreatStephan`), le résout en channelId (`UCxxx`), fetch les vidéos RSS. Le `channelName` du flux RSS est "SEROTHS", mais on stockait le handle d'entrée original dans `channelHandle`.

---

### 2. Suppression d'une chaîne suivie ne supprime pas ses vidéos

**Symptôme:** Un utilisateur supprime une chaîne suivie (ex: `@MrGreatStephan`). Les vidéos de cette chaîne restent affichées.

**Cause racine:** Les queries `getCachedVideos()` et `getCachedLiveStreams()` utilisaient `OR: [{ channelId }, { channelHandle }]`. Même si `channelId` était supprimé, le `channelHandle` pouvait encore matcher.

---

## Solutions implémentées

### Fix 1: Canonical handle = input handle

Modified `fetchChannelVideos()` pour stocker le handle d'entrée tel quel (si c'est un vrai handle `@xxx`) ou le channelId (si c'est un ID `UCxxx`):

```typescript
channelHandle: handle.startsWith('@') ? handle : channelId
```

Maintenant, quand on query par `channelHandle IN (...)`, on matche correctement les vidéos du handle suivi.

### Fix 2: Query par channelId uniquement

Modified `getCachedVideos()` et `getCachedLiveStreams()` pour query uniquement par `channelId`:

```typescript
where: {
  publishedAt: { gte: sevenDaysAgo },
  isLive: false,
  channelId: { in: channelIds },
}
```

On n'utilise plus `channelHandle` dans les queries. `channelId` est la source de vérité.

### Fix 3: Cleanup videos lors de la suppression de chaînes

Modified `saveChannelHandles()` pour supprimer les vidéos des channels qui ne sont plus suivis:

```typescript
// Delete videos from channels we no longer follow
await prisma.youtubeVideo.deleteMany({
  where: { channelId: { notIn: validIds } },
});
```

### Fix 4: Optimisation du loading (non-blocking)

Modified `getLatestVideos()` pour ne jamais blocker - retourne immédiatement le cache, MAJ en background:

```typescript
async getLatestVideos(limit: number = 20): Promise<any[]> {
  const cached = await this.getCachedVideos(limit);

  const needsUpdate = cached.length === 0 ||
                       (cached.length < limit && now - this.lastFetchAt > FETCH_TTL_MS);

  if (needsUpdate && !this.fetchInFlight) {
    this.fetchInFlight = this.fetchAndCacheLatestVideos()...;
  }

  return cached; // Retourne immédiatement
}
```

### Fix 5: Pré-chauffage du cache au démarrage

Added `preWarmCache()` appelé au démarrage du serveur en arrière-plan:

```typescript
// server/src/app.ts
youtubeService.preWarmCache().catch(e => console.warn('[YouTube] Pre-warm failed:', e));
```

---

## Points de blocagelevés

### Point bloquant: resolveChannelIdToHandle() retourne null

**Problème:** Cette méthode essaie d'extraire le handle depuis `youtube.com/channel/{channelId}` mais YouTube charge cette info dynamiquement via JS.

**Solution appliquée:** Suppression de `resolveChannelIdToHandle()` et simplification de la logique:
- Si input = handle (`@xxx`) → utiliser le handle directement
- Si input = ID (`UCxxx`) → utiliser l'ID comme channelHandle

Résultat: Pas de mismatch, le `channelHandle` stocké correspond exactement à ce que l'utilisateur a configuré.

---

## Résumé des changements

| Fichier | Changement |
|---------|------------|
| `youtube.service.ts` | `fetchChannelVideos()` - canonical handle = input |
| `youtube.service.ts` | `getCachedVideos()` - query par channelId uniquement |
| `youtube.service.ts` | `getCachedLiveStreams()` - query par channelId uniquement |
| `youtube.service.ts` | `saveChannelHandles()` - cleanup videos des channels supprimés |
| `youtube.service.ts` | `getLatestVideos()` - non-blocking, background update |
| `youtube.service.ts` | `preWarmCache()` - pré-chauffage au démarrage |
| `app.ts` | `preWarmCache()` appelé au startup |

---

## Test à effectuer

1. **Redémarrer le serveur** pour charger les modifications
2. **Follow une nouvelle chaîne** → vérifier que ses vidéos apparaissent
3. **Unfollow une chaîne** → vérifier que ses vidéos sont supprimées
4. **Vérifier le loading** → "Loading streams, videos, news..." devrait être quasi instantané si cache pré-chauffé

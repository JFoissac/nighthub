# YouTube Recaps - Optimisation du Loading

**Date:** 2026-04-28
**Statut:** Implémenté

---

## Problème de performance

**Symptôme:** L'étape "Loading streams, videos, news..." prend longtemps (10-30 secondes) lors du premier chargement ou quand le cache YouTube est vide.

**Cause racine:** Quand le cache YouTube est vide, `getLatestVideos()` déclenche `fetchAndCacheLatestVideos()` en arrière-plan. Cette méthode doit:

1. Résoudre les 144 handles vers des channelIds (via requêtes HTTP)
2. Fetch les flux RSS de toutes les chaînes en parallèle (concurrence 20)
3. Pour chaque chaîne, jusqu'à 15 vidéos × 144 chaînes = potentiellement 2160 vidéos à traiter
4. Sauvegarder tout en DB

Le problème: Le fetch RSS est I/O bound et lent (latence réseau).

---

## Solutions implémentées

### 1. Non-blocking getLatestVideos()

`getLatestVideos()` retourne immédiatement le cache, MAJ en background si nécessaire.

```typescript
async getLatestVideos(limit: number = 20): Promise<any[]> {
  const cached = await this.getCachedVideos(limit);

  const needsUpdate = cached.length === 0 ||
                       (cached.length < limit && now - this.lastFetchAt > FETCH_TTL_MS);

  if (needsUpdate && !this.fetchInFlight) {
    this.fetchInFlight = this.fetchAndCacheLatestVideos()...;
  }

  return cached; // Retourne immédiatement, même si cache pas à jour
}
```

### 2. Pré-chauffage du cache au démarrage

Au démarrage du serveur, `preWarmCache()` est appelé en arrière-plan pour pré-charger les vidéos avant la première requête.

```typescript
// server/src/app.ts
youtubeService
  .preWarmCache()
  .catch((e) => console.warn('[YouTube] Pre-warm failed:', e));
```

### 3. fetchAndCacheLatestVideos() utilise uniquement les channelIds

Avant: utilisait `allSources = [...handles, ...channelIds]` (doublons)
Après: `allIds = [...new Set([...channelIds, ...resolvedIds])]` (sans doublons)

---

## Résultats attendus

- **Premier chargement après restart:**~1-2 secondes (cache pré-chauffé en arrière-plan)
- **Requêtes suivantes:**< 100ms (cache disponible)
- **Mises à jour:** En arrière-plan, ne block plus jamais

---

## Points restants à améliorer

1. **resolveChannelIdToHandle()** retourne null car YouTube charge les handles dynamiquement
2. **Délai entre batches** pas encore implémenté (peut surcharger l'API)
3. **Timeout global** pas encore implémenté

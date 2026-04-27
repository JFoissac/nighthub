# NightHub — Plan d'Implémentation & Correctifs

**Date :** 25 avril 2026
**Statut :** En cours — Phase de consolidation architecture + tests

---

## Problèmes réels identifiés (vs croyances du plan précédent)

| Problème | Ce qu'on croyait | La réalité | Action requise |
|----------|------------------|------------|----------------|
| **YouTube** `channelId` manquant | Ajouter `channelId` au schema | **Déjà présent** dans Prisma + cache + requête. Le vrai bug : `getChannelIds()` persiste les IDs résolus indépendamment des handles. Quand on supprime un handle, son ID reste en préférence et alimente `getCachedVideos()` via le `OR` Prisma. | Nettoyer les IDs orphelins quand les handles changent. |
| **X/Nitter** cache manquant | Implémenter TTL 30min + cache-first | **Déjà implémenté** : `getTimeline()` retourne cache instantanément + `refreshTimeline()` en background via `setImmediate`. | ✅ Rien à faire (sauf tests). |
| **RSS** détection auto manquante | Implémenter `detectFeed` | **Déjà implémentée** côté backend (`news.service.ts`) + modal frontend (`rss-detect-modal.component`). | ✅ Rien à faire (sauf tests). |
| **Backend hors Nx** | C'est un monorepo Nx | Le backend `server/` a son propre `package.json`, `node_modules`, n'apparaît pas dans `nx graph`. | Intégrer le backend dans Nx. |
| **Angular runtime en `devDependencies`** | Build fonctionne | `@angular/core`, `@angular/router` etc. sont en `devDependencies`. Risque build prod cassé. | Déplacer en `dependencies`. |
| **Jest + Vitest coexistants** | Tests fonctionnels | `jest.config.ts` + `vitest.config.ts` + `package.json` pointe sur Jest, mais backend utilise Vitest. | Clarifier : backend = Vitest, frontend = ? |

---

## Correctifs en cours

### 1. Architecture Nx
- [x] Intégrer le backend dans `nx graph` via `server/project.json`
- [x] Ajouter `workspaceLayout` et `defaultBase` dans `nx.json`
- [x] Ajouter des tags Nx (`scope:frontend`, `scope:backend`, `type:app`, `type:service`)
- [x] Configurer `@nx/enforce-module-boundaries` dans ESLint
- [x] Ajouter des `paths` mappings dans `tsconfig.json`

### 2. Tests
- [x] Backend : `youtube.service.test.ts` (27 tests)
- [x] Backend : `twitter.service.test.ts` (21 tests)
- [x] Backend : `news.service.test.ts` (complet avec `detectFeed`, `validateFeedUrl`)
- [x] Backend : `aggregator.service.test.ts` (scoring, cron)
- [x] Backend : `api.routes.test.ts` (intégration Express — 24 tests)
- [x] Frontend : `video-card.component.spec.ts`
- [x] Frontend : `tweet-card.component.spec.ts`
- [x] Frontend : `rss-detect-modal.component.spec.ts`
- [x] Frontend : `api.service.spec.ts`
- [x] Frontend : `header.component.spec.ts`
- [x] Frontend : `weather.component.spec.ts`
- [x] Frontend : `dashboard.component.spec.ts`
- [x] Frontend : `ai-news.service.spec.ts`
- [x] Frontend : `trump.service.spec.ts`

### 3. YouTube — Solution retenue (Hybrid RSS + API v3 + Piped fallback)

**Pourquoi :** Le RSS par chaîne est gratuit, simple, déjà en place. L'API v3 seule est trop coûteuse (`search.list` = 100 unités/appel). Le scraping HTML est trop fragile.

**Architecture :**

```
Couche 1 (principal) : Flux RSS par chaîne
  → https://www.youtube.com/feeds/videos.xml?channel_id=ID
  → 15 dernières vidéos, très léger, pas de clé API
  → Retry exponentiel avec jitter en cas de 404
  → Concurrence limitée à 20

Couche 2 (durées / filtres shorts) : YouTube Data API v3 — UNIQUEMENT videos.list
  → RSS fournit la liste des videoIds
  → Appel batch `videos.list?part=contentDetails&id=...` (1 unité / 50 IDs)
  → 50 chaînes × 15 vidéos = 750 IDs → 15 unités/jour (vs 5 000 avec search.list)
  → Filtrage shorts par durée exacte (< 60s)

Couche 3 (fallback) : Piped / Invidious
  → Fallback automatique quand API v3 manque ou échoue
  → `GET /streams/{videoId}` retourne `duration` en secondes
  → Concurrence limitée à 10 appels parallèles
  → Configurable via `PIPED_INSTANCE_URL` dans .env
```

**Gestion des shorts :**
1. Heuristique rapide : `#shorts` dans le titre, `/shorts/` dans l'URL
2. Durée précise : `< 60s` via API v3 (si clé configurée)
3. Fallback : si pas de durée, garder l'heuristique seule

**Gestion des IDs orphelins :**
- Quand `saveChannelHandles()` est appelé, comparer les anciens handles avec les nouveaux
- Supprimer de `youtubeChannelIds` les IDs dont le handle correspondant a été retiré
- Ou plus simple : ne pas persister les IDs résolus dans les préférences, les stocker dans une table dédiée `YoutubeChannel` avec relation handle → id + `lastResolvedAt`

### 4. Qualité backend
- [ ] Extraire les routes Express monolithiques (`api.routes.ts` 324 lignes)
- [ ] Sortir `node-cron` du constructeur de `AggregatorService`
- [ ] Ajouter validation d'input (Zod) sur les routes
- [ ] Remplacer les singletons manuels par des factories testables

---

## API Endpoints

```
GET  /health                           → Health check
GET  /api/tweets                      → Get tweets (query: limit)
GET  /api/streams                     → Get live streams
GET  /api/videos                      → Get YouTube feed
GET  /api/news                        → Get AI news
GET  /api/weather?city=Caen           → Get weather
POST /api/refresh/all                 → Force refresh all sources
POST /api/refresh/:source             → Refresh specific source
GET  /api/feeds/dashboard             → Aggregated feed for dashboard
GET  /api/preferences                 → Get user preferences
PUT  /api/preferences                 → Update preferences
POST /api/sites/detect-feed          → Detect RSS feed from URL
```

## Variables d'environnement

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
YOUTUBE_API_KEY=your_key          # Optionnel mais recommandé pour durées exactes
OPENWEATHERMAP_API_KEY=a74ad14a60941c71f4640e590912d3ac
# Piped/Invidious fallback optionnel :
# PIPED_INSTANCE_URL=https://pipedapi.kavin.rocks
```

## Cron Jobs

- Toutes les 30 min : Refresh all data sources
- Toutes les 5 min : Check Twitch live status
- Toutes les 15 min : Refresh Trump tweets

---

## Phase actuelle : Consolidation

1. ✅ Tests backend (youtube, twitter, news, aggregator, api.routes)
2. ✅ Intégration backend dans Nx (`server/project.json`, tags, boundaries)
3. ✅ Tests frontend (video-card, tweet-card, rss-detect-modal, api.service, header, weather, dashboard)
4. ✅ Implémentation solution YouTube hybride (RSS + API v3 + Piped fallback)
5. ✅ Validation Zod sur les routes (middleware `validateBody`)
6. ✅ Retry RSS avec jitter + fallback Piped pour les durées
7. ⏳ Refactoring routes backend (extraction modulaire)
8. ⏳ Intégration backend dans workspace package manager

# NightHub — Plan d'Implémentation & Correctifs

**Date :** 25 avril 2026 (dernière mise à jour : 7 août 2026)
**Statut :** En cours — Consolidation (presque toutes les phases faites) + chantier perf chargement au lancement

---

## État actuel (7 août 2026)

- **Perf boot réglée** (commit `4888db6`) : boot 60–120s → **5.8s** (listen-first + background tasks + snapshot Trump persistant + preWarm gate < 1h). Détails : `docs/BACKEND_REFACTOR.md` et skill `node-server-boot-performance` (réf. nighthub-boot-fix.md).
- **Chantier en cours : chargement des données au lancement du back.** Le serveur écoute vite mais le premier remplissage des caches (Twitch GQL, YouTube RSS, X/Nitter, Trump, news, dashboard snapshot) prend du temps au démarrage → le dashboard peut être vide/stale au premier affichage. Review perf en cours (kimi) pour mesurer et prioriser les correctifs.
- **Changements NON commités dans le repo** (au 07/08) : `server/src/routes/twitch.routes.ts`, `server/src/services/trump.service.ts`, `server/src/services/twitch.service.ts`, `server/data/trump-trained-profile.json`, frontend `settings-sources`, `stream-player-panel`, `trump-card`, `models/index.ts`, `api.service.ts`. À commiter/vérifier.
- **Frontend** : Angular 21.2 + Nx 22.6, port dev 4201 (API backend 3001, CORS 4200+4201).

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
- [x] Extraire les routes Express monolithiques (`api.routes.ts` 324 lignes)
- [x] Sortir `node-cron` du constructeur de `AggregatorService`
- [x] Ajouter validation d'input (Zod) sur les routes
- [x] Remplacer les singletons manuels restants par des factories testables
- [x] Documenter le refactor backend dans `docs/BACKEND_REFACTOR.md`

### 5. Refresh dashboard en arrière-plan
- [x] Ajouter un bouton de refresh non bloquant sur le dashboard
- [x] Rafraîchir les sections visibles en arrière-plan sans vider les listes
- [x] Afficher un indicateur de chargement par section pendant le refresh
- [x] Afficher un état "mis à jour" quand les nouvelles données sont arrivées
- [x] Conserver la navigation et les panneaux ouverts pendant le refresh
- [x] Ajouter les tests de non-régression sur le cycle refresh / rendu / stabilité UI

### 6. Trump
- [x] Revoir la criticité Trump
- [x] Définir le bon seuil de déclenchement et l'impact sur l'affichage
- [x] Réserver les `10/10` aux cas réellement critiques (guerre, frappes, sanctions massives, démissions majeures)
- [x] Ajouter la remontée des payloads complets + métadonnées média (images, raw payload) pour audit/debug
- [x] Mettre en place un entraînement de fond sur dataset historique avec snapshot JSON persistant

**Flux retenu :**

```
Dataset historique local
  → priorité: docs/djt_posts_dec2025.csv
  → fallback: docs/tweets_01-08-2021.json

Trainer de fond
  → infère un corpus faible/bruité (posts bénins, économiques, nominations, alertes géopolitiques)
  → calcule un profil appris
  → persiste un snapshot JSON sur disque

Scoring live
  → charge le snapshot appris au démarrage
  → fusionne ce profil avec le corpus manuel + les posts récents mis en cache
  → n'analyse plus le dataset massif en ligne à chaque refresh
```

**Réglage criticité :**
- `10/10` uniquement pour guerre/attaque/frappe/bombardement/blocage/sanctions extrêmes/tarifs massifs/démission top cabinet
- pénalités fortes pour endorsements, télé-rallies, voter ID, record exports / trade deficit, nominations administratives
- apprentissage négatif explicite sur les ancres de faux signaux récurrents

### 7. Stocks
- [x] Ajouter les gros tickers stocks au dashboard
- [x] Couvrir au minimum les groupes suivants:
  - [x] Magnificent 7
  - [x] IA
  - [x] Tech
  - [x] Armement
  - [x] Matières premières
- [x] Définir le mapping des tickers et leurs catégories d'affichage
- [x] Ajouter les tests de chargement et d'affichage des nouveaux groupes

### 8. Nettoyage de référence et code mort
- [x] Réduire `references/NowStreaming/` à un snapshot utile pour l'import Twitch
- [x] Supprimer le clone Git embarqué et les assets de jeu non utilisés
- [x] Nettoyer les imports/types manifestement inutilisés dans l'application et les tests

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

1. ✅ Tests backend (youtube, twitter, news, aggregator, api.routes + trump.*, weather, twitch, market)
2. ✅ Intégration backend dans Nx (`server/project.json`, tags, boundaries)
3. ✅ Tests frontend (video-card, tweet-card, rss-detect-modal, api.service, header, weather, dashboard, ai-news, trump)
4. ✅ Implémentation solution YouTube hybride (RSS + API v3 + Piped fallback)
5. ✅ Validation Zod sur les routes (middleware `validateBody`)
6. ✅ Retry RSS avec jitter + fallback Piped pour les durées
7. ✅ Refactoring routes backend (extraction modulaire, controllers/middleware/jobs)
8. ✅ Perf boot (listen-first, snapshot Trump, preWarm gate) — commit 4888db6
9. ⏳ Intégration backend dans workspace package manager
10. 🔄 **Perf chargement des données au lancement** : dashboard utilisable immédiatement (review kimi en cours → correctifs P0/P1/P2)

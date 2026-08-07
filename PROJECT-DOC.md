# NightHub — Documentation Fonctionnelle et Technique

Dernière mise à jour : 7 août 2026 (alignée sur l'état réel du code — commit `4888db6` + changements en cours)

## Vue d'ensemble

NightHub est un dashboard personnel nocturne qui agrège en une seule page : les streams Twitch live, les dernières vidéos YouTube, la timeline Twitter/X, les tweets de Trump avec analyse de criticité, les news IA (Anthropic, OpenAI, Kimi), la météo hebdomadaire et les marchés (stocks par groupes).

L'objectif est d'avoir **zéro donnée en dur** : tout est scraphé, fetché via RSS/GQL, ou configuré par l'utilisateur via un modal de settings.

---

## Architecture globale

```
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Angular 21 + Tailwind)                │
│   Dashboard ← → ApiService (HttpClient) ← → Signals (state)      │
│   Settings Modal (popup de configuration)                         │
└────────────────────────────┬───────────────────────────────────────┘
                             │ HTTP REST (port 4201 → 3001)
┌────────────────────────────▼───────────────────────────────────────┐
│                  BACKEND (Express + TypeScript)                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│   │ Twitch GQL  │  │ YouTube RSS │  │ Twitter/    │              │
│   │ (public)    │  │ (public)    │  │ Nitter RSS  │              │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│   ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐              │
│   │ Trump       │  │ AI News     │  │ Weather     │              │
│   │ Nitter RSS  │  │ Scraping+RSS│  │ OpenWeather │              │
│   └──────┬──────┘  └──────┬──────┘  └──────┴──────┘              │
│          └────────────────┼────────────────┘                      │
│                    Aggregator + Cron Jobs                          │
└──────────────────────────┬────────────────────────────────────────┘
                           ↓
┌──────────────────────────▼────────────────────────────────────────┐
│                   DATABASE (SQLite + Prisma ORM)                   │
│  UserPreference | TwitchStream | YoutubeVideo | Tweet | TrumpTweet│
│  AiNewsItem | WeatherCache | TwitchFollow | OAuthToken            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stack technique (état actuel)

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | Angular | 21.2 |
| CSS | Tailwind CSS | 3.4 |
| State | Angular Signals | natif |
| Build | Nx | 22.6 |
| Backend | Express.js | 4.21 |
| Runtime backend | Node + tsx (dev) / tsc (prod) | — |
| ORM | Prisma | 5.22 |
| Database | SQLite | fichier local |
| Scheduling | node-cron | 3.x |
| RSS | rss-parser | 3.13 |
| Ports | Frontend 4201 · API 3001 (CORS 4200+4201) | — |

---

## Frontend

### Structure des fichiers

```
src/
├── app/
│   ├── app.ts                          # Root component
│   ├── app.config.ts                   # Angular config (providers)
│   ├── app.routes.ts                   # Routes: / et /settings
│   ├── components/
│   │   ├── header/                     # Barre supérieure (horloge, boutons)
│   │   ├── weather/                    # Widget météo semaine
│   │   ├── stream/                     # Card stream Twitch
│   │   ├── video/                      # Card vidéo YouTube
│   │   ├── tweet/                      # Card tweet Twitter
│   │   ├── trump/                      # Card Trump avec criticité
│   │   ├── ai-news/                    # Card news AI
│   │   ├── card/                       # Card générique
│   │   └── settings-modal/            # Modal de configuration
│   ├── pages/
│   │   ├── dashboard/                  # Page principale
│   │   └── settings/                   # Page settings (legacy)
│   ├── models/
│   │   └── index.ts                    # Interfaces TypeScript
│   └── services/
│       ├── api.service.ts              # HttpClient vers le backend (baseUrl 3001)
│       ├── ai-news.service.ts
│       ├── trump.service.ts
│       ├── twitch.service.ts
│       ├── twitter.service.ts
│       ├── weather.service.ts
│       └── youtube.service.ts
├── styles.css                          # Tailwind + theme custom
├── index.html
└── main.ts
```

### Routes

| Route | Composant | Description |
|-------|-----------|-------------|
| `/` | DashboardComponent | Page principale avec tous les modules |
| `/settings` | SettingsComponent | Page settings legacy |

### Dashboard (page principale)

1. **Top Row (3 colonnes)** : AI Blog (Anthropic / OpenAI / Kimi) — scrollable · Trump Watch avec badge CRITICALITY — scrollable · Météo semaine + stats rapides
2. **Twitch Live** — grille de stream cards
3. **YouTube — Mes Abonnements** — grille de video cards
4. **X / Twitter** — grille de tweet cards
5. **Marchés** — groupes de tickers (Magnificent 7, IA, Tech, Défense, Matières premières, Indices)

Chaque section affiche un **empty state** avec lien "Configurer…" qui ouvre le modal settings.

### Settings Modal

| Section | Champs | Fonctionnement |
|---------|--------|----------------|
| Twitch | Username + liste | Import auto GQL ou collage de noms |
| YouTube | Liste de handles | Collage de @handles |
| Twitter/X | Username | Timeline via Nitter RSS |
| Trump Watch | Slider 0-10 | Filtre criticité minimum |
| Météo | Ville | OpenWeatherMap |
| RSS perso | URLs | Flux RSS additionnels |
| Refresh | Slider 5-60 min | Intervalle cron |

---

## Backend

### Perf boot (fait — commit 4888db6)

- **Boot 60–120s → 5.8s** : `prisma.$connect()` → `app.listen()` → tâches lourdes dans le callback (jamais avant listen).
- Tâches background post-listen : `cleanOrphanChannelIds`, `preWarmCache` (skip si cache frais < 1h), `trumpTrainingService.start()` (snapshot JSON persistant chargé au constructeur, retrain 6h en arrière-plan avec yields), `aggregatorService.refreshAll()`, pré-warm du dashboard snapshot.
- **Chantier en cours** : premier remplissage des données au lancement (le dashboard doit être utilisable immédiatement, pas après le refresh initial des sources externes).

### Structure des fichiers (état actuel)

```
server/
├── prisma/
│   ├── schema.prisma               # Schéma de la base
│   └── dev.db                      # Base SQLite
├── src/
│   ├── app.ts                      # Point d'entrée Express (listen-first + background)
│   ├── config/env.ts               # Variables d'environnement
│   ├── controllers/                # Controllers par domaine (extraits des routes)
│   ├── db/prisma.client.ts         # Instance Prisma
│   ├── jobs/                       # Jobs planifiés
│   ├── middleware/                 # cors, error handler, validateBody (Zod), rate limit
│   ├── routes/                     # health.routes, auth.routes, api.routes, twitch.routes
│   ├── services/                   # Voir détail ci-dessous
│   └── utils/logger.ts             # Logger
├── package.json                    # dev: tsx src/app.ts · vitest · prisma
└── tsconfig.json
```

### Services (état actuel)

| Service | Fichiers | Rôle |
|---------|----------|------|
| Aggregator | `aggregator.service.ts` | Orchestrateur + cron + scoring |
| Twitch | `twitch.service.ts` | GQL public (`kimne78kx3ncx6brgo4mv6wki5h1ko`), streams live, imports |
| YouTube | `youtube.service.ts` | RSS par chaîne + API v3 (durées) + fallback Piped |
| Twitter/X | `twitter.service.ts` | Nitter RSS multi-instances, cache TTL 30 min |
| Trump | `trump.service.ts` + `trump.trainer.ts` + `trump.scoring.ts` + `trump.archive.ts` + `trump.training-corpus.ts` + `trump.weak-scorer.ts` + `trump-severity.ts` | RSS Nitter, criticité 0-10 (profil entraîné + corpus manuel + snapshot persistant), sentiment, isBreaking ≥ 7 |
| News | `news.service.ts` | OpenAI RSS, Anthropic scraping, Kimi scraping + fallback |
| Météo | `weather.service.ts` | OpenWeatherMap, cache |
| Marchés | `market.service.ts` + `market.catalog.ts` | Tickers par groupes, cache |
| Runtime | `backend.runtime.ts` | Singletons/factories des services |

### API Endpoints (état actuel)

```
GET  /health                           Health check

GET  /api/dashboard                    Données agrégées pour le dashboard
GET  /api/feeds/dashboard              Flux agrégé (dashboard)
GET  /api/streams                      Streams Twitch live
GET  /api/follows?username=X           Follows Twitch (profile lookup)
GET  /api/videos                       Vidéos YouTube récentes
GET  /api/tweets?limit=N               Timeline Twitter
GET  /api/trump?limit=N                Tweets Trump (cache + criticité)
GET  /api/news?limit=N                 News AI (cache)
GET  /api/weather?city=X               Météo semaine
GET  /api/market                       Marchés (groupes de tickers)

POST /api/refresh/all                  Force refresh de tout
POST /api/refresh/news                 Refresh news
POST /api/refresh/twitch               Refresh Twitch
POST /api/refresh/trump                Refresh Trump

POST /api/twitch/import-follows        Import follows depuis username Twitch
POST /api/twitch/import-list           Import depuis liste de noms
POST /api/youtube/import-list          Import handles YouTube

GET  /api/preferences                  Lire les préférences
POST /api/preferences                  Sauvegarder les préférences
```

Rate limiting : général 100 req/min sur /api, strict 10 req/min sur /api/refresh/* et /api/auth/*.

### Cron Jobs

- `*/30 * * * *` : refresh all
- `*/5 * * * *` : check Twitch live
- `*/15 * * * *` : refresh Trump
- Retrain Trump toutes les 6 h (snapshot persistant `server/data/trump-trained-profile.json`)

### Base de données (Prisma/SQLite)

```
UserPreference
├── weatherCity, twitchFollows (CSV), twitchUsername, youtubeChannels (CSV)
├── twitterUsername, trumpMinCriticality (0-10), customRssFeeds, refreshInterval

TwitchStream      twitchId, title, thumbnailUrl, viewerCount, channelName, channelAvatar, gameName, isLive, url
YoutubeVideo      youtubeId, title, thumbnailUrl, channelName, channelAvatar, duration, views, url, isNew
Tweet             twitterId, authorName, authorHandle, authorAvatar, content, mediaUrl, likes, retweets
TrumpTweet        (tweets Trump + criticité + sentiment + type)
AiNewsItem        (news IA)
WeatherCache      (météo)
TwitchFollow      (follows importés)
OAuthToken        (legacy)
```

---

## État du projet (7 août 2026)

- **Perf boot réglée** : 5.8s (listen-first + snapshot + preWarm gate) — commit 4888db6.
- **Chantier en cours** : chargement des données au lancement du back (dashboard utilisable immédiatement) — review perf en cours, correctifs P0/P1/P2 à venir.
- **Changements non commités** : `server/src/routes/twitch.routes.ts`, `server/src/services/trump.service.ts`, `server/src/services/twitch.service.ts`, `server/data/trump-trained-profile.json`, frontend `settings-sources`, `stream-player-panel`, `trump-card`, `models/index.ts`, `api.service.ts`.
- Détails de chantier : voir `PLAN.md` (phases) et `docs/BACKEND_REFACTOR.md`.

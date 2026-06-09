# NightHub - Documentation du Projet

**Dernière mise à jour**: 2026-06-09
**Version**: 1.0.0
**Statut**: En développement actif

---

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Stack Technique](#stack-technique)
4. [Structure du Projet](#structure-du-projet)
5. [API Endpoints](#api-endpoints)
6. [Modèles de Données](#modèles-de-données)
7. [Services](#services)
8. [Configuration](#configuration)
9. [Commandes Utiles](#commandes-utiles)
10. [Problèmes Connus](#problèmes-connus)
11. [Améliorations à Venir](#améliorations-à-venir)

---

## Vue d'Ensemble

**NightHub** est un dashboard personnel nocturne qui agrège du contenu de plusieurs plateformes:

- **Twitter/X**: Timeline avec tweets
- **YouTube**: Dernières vidéos des chaînes abonnées
- **Twitch**: Streams en direct des streamers suivis
- **AI News**: Actualités AI depuis plusieurs sources RSS
- **Trump Watch**: Tweets de Trump avec analyse de sentiment
- **Weather**: Prévisions météo pour une ville configurable

### Caractéristiques Principales

- **Mise à jour en temps réel** via Server-Sent Events (SSE)
- **Cache-first** avec rafraîchissement en arrière-plan
- **Import depuis Google Takeout** pour YouTube
- **Import de listes** pour Twitch et Twitter
- **Thème "Terminal Luxe"** avec esthétique cyberpunk

---

## Architecture

```
nighthub/
├── src/                          # Angular 21 frontend (Nx workspace)
│   ├── app/
│   │   ├── pages/
│   │   │   └── dashboard/        # Page principale
│   │   ├── components/
│   │   │   ├── header/          # Header avec recherche
│   │   │   ├── sections/        # Sections (Twitter, YouTube, Streams, News, Trump)
│   │   │   ├── video/           # Cartes vidéo + player
│   │   │   ├── stream/          # Cartes stream + player
│   │   │   ├── settings-modal/  # Modal de configuration
│   │   │   └── weather/         # Widget météo
│   │   ├── services/            # API client
│   │   ├── stores/              # NgRx Signal stores
│   │   └── models/              # Interfaces TypeScript
│   └── main.ts                  # Point d'entrée Angular
│
├── server/                       # Express.js backend
│   ├── prisma/
│   │   └── schema.prisma        # Schéma SQLite
│   └── src/
│       ├── routes/              # Routes modulaires
│       ├── services/            # Logique métier
│       ├── middleware/          # Error & CORS
│       ├── db/                  # Prisma client
│       └── config/              # Variables d'environnement
│
├── docs/                         # Documentation
└── nx.json                      # Configuration Nx
```

---

## Stack Technique

### Frontend

| Technologie | Version | Usage |
|-------------|---------|-------|
| Angular | 21.2.x | Framework principal |
| Nx | 22.6.5 | Workspace monorepo |
| NgRx Signals | 21.1.x | State management |
| Tailwind CSS | 3.4.x | Styling |
| TypeScript | 5.9.x | Typage |

### Backend

| Technologie | Version | Usage |
|-------------|---------|-------|
| Node.js | 20.x | Runtime |
| Express | 4.21.x | Framework HTTP |
| Prisma | 5.x | ORM |
| SQLite | 3.x | Base de données |
| Zod | 3.x | Validation |

### Outils

| Technologie | Usage |
|-------------|-------|
| Vitest | Tests backend |
| Jest | Tests frontend |
| ESLint | Linting |
| Prettier | Formatage |

---

## Structure du Projet

### Frontend (src/app)

```
src/app/
├── pages/
│   └── dashboard/
│       ├── dashboard.component.ts    # Composant principal
│       └── dashboard.component.spec.ts
│
├── components/
│   ├── header/                      # Header avec icônes et recherche
│   ├── sections/
│   │   ├── twitter-section.component.ts
│   │   ├── youtube-section.component.ts
│   │   ├── streams-section.component.ts
│   │   ├── news-section.component.ts
│   │   └── trump-section.component.ts
│   ├── video/
│   │   ├── video-card.component.ts   # Carte vidéo YouTube
│   │   ├── video-player-popup.component.ts
│   │   └── video-player-panel.component.ts
│   ├── stream/
│   │   ├── stream-card.component.ts  # Carte stream Twitch
│   │   ├── stream-player-panel.component.ts
│   │   └── stream-list-popup.component.ts
│   ├── settings-modal/
│   │   └── settings-modal.component.ts
│   ├── weather/
│   │   ├── weather.component.ts
│   │   └── weather-popup.component.ts
│   ├── ai-news/
│   │   └── ai-news-card.component.ts
│   ├── tweet/
│   │   └── tweet-card.component.ts
│   └── trump/
│       └── trump-card.component.ts
│
├── services/
│   ├── api.service.ts               # Client HTTP
│   ├── youtube.service.ts
│   ├── twitter.service.ts
│   ├── twitch.service.ts
│   ├── news.service.ts
│   ├── weather.service.ts
│   └── trump.service.ts
│
├── stores/
│   ├── videos.store.ts              # NgRx Signal store
│   ├── streams.store.ts
│   ├── news.store.ts
│   ├── tweets.store.ts
│   └── trump.store.ts
│
└── models/
    └── index.ts                     # Interfaces partagées
```

### Backend (server/src)

```
server/src/
├── routes/
│   ├── index.routes.ts              # Export de toutes les routes
│   ├── dashboard.routes.ts          # Dashboard + SSE
│   ├── youtube.routes.ts            # YouTube (import, videos, remap)
│   ├── twitch.routes.ts             # Twitch (streams, follows)
│   ├── news.routes.ts               # News (fetch, detect-feed, extract)
│   ├── twitter.routes.ts            # Twitter + Trump
│   ├── preferences.routes.ts        # Préférences utilisateur
│   └── api.routes.ts                # Point d'entrée compatibilité
│
├── services/
│   ├── youtube.service.ts           # RSS + API v3 + Piped fallback
│   ├── twitter.service.ts           # Nitter RSS
│   ├── twitch.service.ts            # GQL API
│   ├── news.service.ts              # RSS scraping + article extraction
│   ├── weather.service.ts          # OpenWeatherMap API
│   ├── trump.service.ts             # Truth Social mirror
│   └── aggregator.service.ts       # Combine toutes les sources
│
├── middleware/
│   ├── error.middleware.ts
│   └── cors.middleware.ts
│
├── db/
│   └── prisma.client.ts
│
├── config/
│   └── env.ts
│
└── app.ts                           # Express server
```

---

## API Endpoints

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Récupère toutes les données |
| GET | `/api/dashboard/stream` | SSE streaming des données |
| POST | `/api/refresh/all` | Rafraîchit toutes les sources |

### YouTube

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/videos` | Liste des vidéos (query: limit) |
| POST | `/api/youtube/import-list` | Import par handles |
| POST | `/api/youtube/import-takeout` | Import depuis Google Takeout CSV |
| GET | `/api/youtube/remap/report` | Rapport de résolution des handles |
| GET | `/api/youtube/remap/search` | Recherche de chaînes |
| POST | `/api/youtube/remap` | Correction handle → channelId |

### Twitch

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/streams` | Streams en direct |
| GET | `/api/follows` | Liste des follows (query: username) |
| POST | `/api/twitch/import-list` | Import par liste de chaînes |
| POST | `/api/refresh/twitch` | Rafraîchit les streams |

### News

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/news` | Liste des news AI (query: limit) |
| POST | `/api/refresh/news` | Rafraîchit les news |
| POST | `/api/sites/detect-feed` | Détecte un flux RSS |
| POST | `/api/news/extract` | Extrait le texte d'un article |

### Twitter

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tweets` | Timeline (query: limit) |
| GET | `/api/trump` | Tweets Trump (query: limit) |
| POST | `/api/refresh/trump` | Rafraîchit Trump tweets |
| GET | `/api/twitter/account-stats` | Statistiques des comptes |

### Préférences

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/preferences` | Récupère les préférences |
| POST | `/api/preferences` | Sauvegarde les préférences |

---

## Modèles de Données

### UserPreference

```prisma
model UserPreference {
  id               String   @id @default(uuid())
  weatherCity      String   @default("Caen")
  twitchFollows    String   @default("")
  twitchUsername   String   @default("")
  youtubeChannels  String   @default("")
  youtubeChannelIds String  @default("")
  twitterUsername  String   @default("")
  twitterAccounts  String   @default("")
  trumpMinCriticality Int   @default(0)
  customRssFeeds   String   @default("")
  refreshInterval  Int      @default(30)
  themeOledBlack   Boolean  @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

### Tweet

```prisma
model Tweet {
  id             String   @id @default(uuid())
  authorHandle   String
  authorName     String
  authorAvatar   String
  content        String
  likes          Int      @default(0)
  retweets       Int      @default(0)
  tweetId        String   @unique
  fetchedAt      DateTime @default(now())
}
```

### YoutubeVideo

```prisma
model YoutubeVideo {
  id             String   @id @default(uuid())
  youtubeId      String   @unique
  title          String
  thumbnailUrl   String
  channelName    String
  channelAvatar  String
  channelId      String
  channelHandle  String
  duration       String
  views          Int      @default(0)
  url            String
  isNew          Boolean  @default(false)
  isLive         Boolean  @default(false)
  publishedAt    DateTime
  fetchedAt      DateTime @default(now())
}
```

### TwitchStream

```prisma
model TwitchStream {
  id             String   @id @default(uuid())
  streamId       String   @unique
  channelName    String
  channelHandle  String
  channelAvatar  String
  gameName       String
  title          String
  thumbnailUrl   String
  viewerCount    Int      @default(0)
  isLive         Boolean  @default(false)
  startedAt      DateTime
  fetchedAt      DateTime @default(now())
}
```

### AiNewsItem

```prisma
model AiNewsItem {
  id          String   @id @default(uuid())
  title       String
  source      String
  url         String   @unique
  summary     String
  pubDate     DateTime
  isNew       Boolean  @default(false)
  categories  String   @default("")
  author      String   @default("")
  fetchedAt   DateTime @default(now())
}
```

### TrumpTweet

```prisma
model TrumpTweet {
  id           String   @id @default(uuid())
  tweetId      String   @unique
  content      String
  authorName   String   @default("Donald Trump")
  authorHandle String   @default("@realDonaldTrump")
  likes        Int      @default(0)
  retweets     Int      @default(0)
  sentiment    Float
  criticality  Int      @default(0)
  fetchedAt    DateTime @default(now())
}
```

---

## Services

### YouTube Service

**Fonctionnalités:**
- Résolution des handles (@name) vers channel IDs
- Fetch RSS par chaîne (15 dernières vidéos)
- Fetch durées via API v3 ou Piped fallback
- Filtre Shorts (< 60s ou #shorts dans le titre)
- Cache avec invalidation intelligente

**Handles résolution:**
1. YouTube Data API v3 (`forHandle`)
2. Scraping HTML (`youtube.com/@handle`)
3. Circuit breaker pour erreurs réseau

### Twitter Service

**Fonctionnalités:**
- Lecture de plusieurs comptes via RSS (Nitter)
- Cache avec TTL
- Fallback sur cache en cas de rate limit

**Limitations:**
- Nitter est souvent rate-limited (429)
- Dépendance externe non fiable

### Twitch Service

**Fonctionnalités:**
- Import depuis liste de chaînes
- Récupération des follows via GQL
- Vérification live status

**Limitations:**
- Import par username cassé (GQL `follows` non exposé)
- Seule l'import par liste fonctionne

### News Service

**Fonctionnalités:**
- Fetch RSS multiples (OpenAI, Anthropic, Kimi, sources custom)
- Scrape des pages Anthropic et Kimi
- Extraction de texte d'articles
- Validation URL (anti-ssrf)
- Détection de paywall

**Sources par défaut:**
- https://openai.com/news/rss.xml
- https://www.anthropic.com/news
- https://www.kimi.com/blog/
- https://next.ink/feed/free
- https://www.numerama.com/feed/
- https://www.frandroid.com/feed/

### Weather Service

**Fonctionnalités:**
- Prévisions 7 jours via OpenWeatherMap
- Cache des résultats
- Ville configurable

### Aggregator Service

**Fonctionnalités:**
- Combine toutes les sources
- Filtrage par preferences utilisateur
- Cron jobs pour refresh automatique

---

## Configuration

### Variables d'Environnement (server/.env)

```env
PORT=3000
NODE_ENV=development
DATABASE_URL="file:./dev.db"

# APIs optionnelles
YOUTUBE_API_KEY=your_key
OPENWEATHERMAP_API_KEY=a74ad14a60941c71f4640e590912d3ac

# Piped fallback (optionnel)
PIPED_INSTANCE_URL=https://pipedapi.kavin.rocks
```

### Préférences Utilisateur

| Champ | Type | Description |
|-------|------|-------------|
| weatherCity | String | Ville pour la météo |
| twitchFollows | String | Liste de chaînes Twitch |
| youtubeChannels | String | Handles YouTube (@channel) |
| youtubeChannelIds | String | Channel IDs importés via Takeout |
| twitterAccounts | String | Comptes Twitter à surveiller |
| trumpMinCriticality | Int | Seuil minimum de criticité (0-10) |
| customRssFeeds | String | URLs RSS personnalisées |
| refreshInterval | Int | Intervalle de refresh en minutes |
| themeOledBlack | Boolean | Mode OLED noir |

---

## Commandes Utiles

### Installation

```bash
# Setup initial
npm run db:setup

# Installer dépendances
npm install
cd server && npm install
```

### Développement

```bash
# Lancer tout (frontend + backend)
npm run dev:all

# Lancer frontend seulement
npm start

# Lancer backend seulement
npm run server

# Lancer backend en dev
cd server && npm run dev
```

### Tests

```bash
# Tous les tests
npm run test

# Tests avec coverage
npm run test:coverage

# Tests frontend
npx nx test

# Tests backend
cd server && npm test
```

### Build

```bash
# Build production
npm run build

# TypeScript check
npx tsc --noEmit
```

---

## Problèmes Connus

### 1. Nitter Rate-Limited

**Problème**: Nitter retourne fréquemment des erreurs 429 (rate limit).

**Impact**: Twitter timeline et Trump Watch peuvent être indisponibles.

**Solution actuelle**: Cache fallback, retry avec backoff.

### 2. YouTube Channel Avatars

**Problème**: Les avatars de chaînes YouTube sont des URLs génériques.

**Impact**: L'affichage des avatars n'est pas optimal.

### 3. Import Twitch par Username

**Problème**: Le GQL `follows` de Twitch n'est plus exposé publiquement.

**Solution de contournement**: Import par liste de chaînes粘贴.

---

## Améliorations à Venir

### Haute Priorité

- [ ] Intégrer backend complètement dans Nx workspace
- [ ] Tests unitaires pour les nouveaux composants
- [ ] Indicateur "première fois" onboarding

### Moyenne Priorité

- [ ] Terminal search (recherche in-app)
- [ ] Mode jour/nuit/neon
- [ ] Lazy-load section YouTube après paint
- [ ] Filtre YouTube par semaine

### Basse Priorité

- [ ] Crypto dashboard fusion
- [ ] Wrapper Perplexity API
- [ ] Données temps réel Trump (Truth Social)

---

## Scripts d'Extraction

### YouTube Subscriptions

1. Aller sur https://www.youtube.com/feed/channels
2. F12 → Console → coller le contenu de `scripts/youtube-subscriptions.js`
3. Scroll automatique (~30 sec)
4. Génère un CSV Google Takeout
5. Importer dans NightHub → Settings → YouTube → Google Takeout CSV

### X Follows

1. Aller sur `x.com/{user}/following`
2. F12 → Console → coller le contenu de `scripts/x-follows.js`
3. Extrait les @handles via `[data-testid="UserCell"]`
4.结果 copié dans le presse-papier

### Twitch Follows

1. Être connecté sur twitch.tv
2. F12 → Console → coller le contenu de `scripts/twitch-follows.js`
3. Lit le cookie `auth-token` et appelle GQL
4.结果 copié dans le presse-papier

---

## Sécurité

### SSRF Protection

Le service News implémente une protection SSRF complète:
- Validation du protocole (http/https seulement)
- Vérification des IPs privées
- Blocage des hostnames suspects
- Validation DNS inversée

### Input Validation

Tous les inputs utilisateur sont validés via Zod:
- Limites de longueur
- Caractères autorisés
- Types corrects

---

## Performance

### Cache Strategy

| Donnée | TTL | Méthode |
|--------|-----|---------|
| YouTube | 5 min | Cache-first |
| Twitch | 2 min | Sync background |
| News | 30 min | Fetch on demand |
| Weather | 30 min | Cache avec fallback |

### Concurrence

- YouTube RSS: 8 requêtes parallèles
- YouTube API: 50 IDs par batch
- Piped fallback: 10 parallèles
- Retry avec jitter exponentiel
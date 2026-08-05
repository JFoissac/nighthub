# NightHub - Documentation Fonctionnelle et Technique

## Vue d'ensemble

NightHub est un dashboard personnel nocturne qui agregene en une seule page : les streams Twitch live, les dernieres videos YouTube, la timeline Twitter/X, les tweets de Trump avec analyse de criticite, les news AI (Anthropic, OpenAI, Kimi), et la meteo hebdomadaire.

L'objectif est d'avoir **zero donnees en dur** : tout est scrape, fetche via RSS/GQL, ou configure par l'utilisateur via un modal de settings.

---

## Architecture globale

```
┌────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Angular 21 + Tailwind)                │
│   Dashboard ← → ApiService (HttpClient) ← → Signals (state)      │
│   Settings Modal (popup de configuration)                         │
└────────────────────────────┬───────────────────────────────────────┘
                             │ HTTP REST (port 4200 → 3000)
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

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Frontend | Angular | 21.2 |
| CSS | Tailwind CSS | 3.4 |
| State | Angular Signals | natif |
| Build | Nx | 22.6 |
| Backend | Express.js | 4.21 |
| ORM | Prisma | 5.22 |
| Database | SQLite | fichier local |
| Scheduling | node-cron | 3.x |
| RSS | rss-parser | 3.13 |
| Runtime | Node.js + ts-node | |

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
│   │   ├── header/                     # Barre superieure (horloge, boutons)
│   │   ├── weather/                    # Widget meteo semaine
│   │   ├── stream/                     # Card stream Twitch
│   │   ├── video/                      # Card video YouTube
│   │   ├── tweet/                      # Card tweet Twitter
│   │   ├── trump/                      # Card Trump avec criticite
│   │   ├── ai-news/                    # Card news AI
│   │   ├── card/                       # Card generique
│   │   └── settings-modal/            # Modal de configuration (NOUVEAU)
│   ├── pages/
│   │   ├── dashboard/                  # Page principale
│   │   └── settings/                   # Page settings (legacy, toujours accessible)
│   ├── models/
│   │   └── index.ts                    # Interfaces TypeScript
│   └── services/
│       ├── api.service.ts              # HttpClient vers le backend
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
| `/settings` | SettingsComponent | Page settings legacy (form simple) |

### Dashboard (page principale)

Le dashboard est divise en sections :

1. **Top Row (3 colonnes)** :
   - AI Blog (Anthropic / OpenAI / Kimi) — scrollable
   - Trump Watch avec badge CRITICALITY — scrollable
   - Meteo semaine + Stats rapides (compteurs)

2. **Twitch Live** — grille 4 colonnes de stream cards
3. **YouTube - Mes Abonnements** — grille 4 colonnes de video cards
4. **X / Twitter** — grille 2 colonnes de tweet cards

Chaque section affiche un **empty state** avec lien "Configurer..." qui ouvre le modal settings.

### Settings Modal

Modal overlay accessible depuis l'icone engrenage du header. Sections :

| Section | Champs | Fonctionnement |
|---------|--------|----------------|
| Twitch | Username + liste | Import auto GQL ou collage de noms |
| YouTube | Liste de handles | Collage de @handles |
| Twitter/X | Username | Timeline via Nitter RSS |
| Trump Watch | Slider 0-10 | Filtre criticite minimum |
| Meteo | Ville | OpenWeatherMap |
| RSS perso | URLs | Flux RSS additionnels |
| Refresh | Slider 5-60 min | Intervalle cron |

Les chaines Twitch/YouTube sont affichees en tags avec bouton de suppression individuel.

### ApiService

Service central Angular qui communique avec le backend :

| Methode | Endpoint | Usage |
|---------|----------|-------|
| `getDashboard()` | GET /api/dashboard | Charge toutes les donnees |
| `refreshAll()` | POST /api/refresh/all | Force le refresh |
| `getPreferences()` | GET /api/preferences | Charge la config user |
| `savePreferences()` | POST /api/preferences | Sauvegarde la config |
| `importTwitchFollows(username)` | POST /api/twitch/import-follows | Auto-import GQL |
| `importTwitchList(channels[])` | POST /api/twitch/import-list | Import liste collee |
| `importYoutubeList(channels[])` | POST /api/youtube/import-list | Import handles YT |
| `getStreams()` | GET /api/streams | Streams Twitch live |
| `getVideos()` | GET /api/videos | Videos YouTube recentes |
| `getTweets()` | GET /api/tweets | Timeline Twitter |
| `getTrumpTweets()` | GET /api/trump | Tweets Trump analyses |
| `getNews()` | GET /api/news | News AI |
| `getWeather(city)` | GET /api/weather | Meteo |

### Theme / Design

- Theme sombre par defaut
- Variables CSS custom : `--background`, `--surface`, `--border`, `--text-primary`, `--text-secondary`, `--primary`, `--accent`
- Polices : Space Grotesk (headlines), Inter (body), JetBrains Mono (mono)
- Animations `fade-in` avec delais staggers

---

## Backend

### Structure des fichiers

```
server/
├── prisma/
│   ├── schema.prisma               # Schema de la base
│   └── dev.db                      # Base SQLite
├── src/
│   ├── app.ts                      # Point d'entree Express
│   ├── config/
│   │   └── env.ts                  # Variables d'environnement
│   ├── db/
│   │   └── prisma.client.ts        # Instance Prisma
│   ├── middleware/
│   │   ├── cors.middleware.ts       # CORS (localhost:4200)
│   │   └── error.middleware.ts      # Error handler global
│   ├── routes/
│   │   ├── health.routes.ts         # GET /health
│   │   ├── auth.routes.ts           # OAuth flows (legacy)
│   │   └── api.routes.ts           # Tous les endpoints API
│   └── services/
│       ├── aggregator.service.ts    # Orchestrateur + cron jobs
│       ├── twitch.service.ts        # Twitch GQL (public, pas d'OAuth)
│       ├── youtube.service.ts       # YouTube RSS (public)
│       ├── twitter.service.ts       # Twitter via Nitter RSS
│       ├── trump.service.ts         # Trump via Nitter + analyse criticite
│       ├── weather.service.ts       # OpenWeatherMap API
│       └── news.service.ts          # AI News (scraping + RSS)
├── package.json
└── tsconfig.json
```

### API Endpoints

```
GET  /health                           Health check

GET  /api/dashboard                    Donnees agregees pour le dashboard
GET  /api/streams                      Streams Twitch live
GET  /api/follows?username=X           Follows Twitch (profile lookup)
GET  /api/videos                       Videos YouTube recentes
GET  /api/tweets?limit=N               Timeline Twitter
GET  /api/trump?limit=N                Tweets Trump (cache)
GET  /api/news?limit=N                 News AI (cache)
GET  /api/weather?city=X               Meteo semaine

POST /api/refresh/all                  Force refresh de tout
POST /api/refresh/news                 Refresh news
POST /api/refresh/twitch               Refresh Twitch
POST /api/refresh/trump                Refresh Trump

POST /api/twitch/import-follows        Import follows depuis username Twitch
     Body: { username: string }
POST /api/twitch/import-list           Import depuis liste de noms
     Body: { channels: string[] }
POST /api/youtube/import-list          Import handles YouTube
     Body: { channels: string[] }

GET  /api/preferences                  Lire les preferences
POST /api/preferences                  Sauvegarder les preferences
     Body: { weatherCity, twitchFollows, twitchUsername,
             youtubeChannels, twitterUsername,
             trumpMinCriticality, customRssFeeds,
             refreshInterval }
```

### Services — Detail technique

#### TwitchService (`twitch.service.ts`)

- **Pas d'OAuth** : utilise le GQL public de Twitch (`gql.twitch.tv/gql`) avec le Client-ID web public `kimne78kx3ncx6brgo4mv6wki5h1ko`
- **getFollowedStreams()** : lit la liste des chaines depuis `UserPreference.twitchFollows`, query GQL `users(logins:[...])` pour checker le stream status
- **importFollowsFromUsername()** : query GQL `user.follows` avec pagination (100 par page). Fallback si la query n'est pas supportee.
- **importFollowsFromList()** : valide les noms de chaines par batch GQL `users(logins:[...])`, retourne valid/invalid
- **Cache** : les streams live sont caches dans `TwitchStream` (Prisma)

#### YoutubeService (`youtube.service.ts`)

- **Pas d'OAuth/API key** : utilise les flux RSS publics YouTube (`youtube.com/feeds/videos.xml?channel_id=X`)
- **resolveChannelId()** : scrape la page YouTube d'un handle `@name` pour extraire le `channelId` (regex sur le HTML)
- **getLatestVideos()** : pour chaque handle configure, resout le channel ID puis parse le RSS. 5 videos max par chaine, triees par date.
- **Cache** : videos cachees dans `YoutubeVideo` (Prisma)

#### TwitterService (`twitter.service.ts`)

- Utilise Nitter (instances multiples en fallback) pour parser le RSS d'un username Twitter
- Instances : nitter.net, nitter.poast.org, nitter.privacydev.net
- **getTimeline()** : fetch le RSS Nitter, parse les items, cache dans `Tweet`
- **Limitation** : Nitter est souvent rate-limited (429)

#### TrumpService (`trump.service.ts`)

- RSS Nitter de `@realDonaldTrump`
- **Analyse de criticite** (score 0-10) basee sur des mots-cles :
  - High (3 pts) : nuclear, war, attack, tariff, sanctions...
  - Medium (2 pts) : deal, congress, economy, crypto...
  - Low (1 pt) : fake news, maga, great...
  - Bonus : points d'exclamation (+1 chacun, max 3)
- **Analyse de sentiment** : positive/negative/neutral (comptage de mots)
- **Classification de type** : decision, scandal, statement, tweet
- **isBreaking** : si criticite >= 7
- Filtrage par `trumpMinCriticality` dans les preferences (dans aggregator)

#### NewsService (`news.service.ts`)

- **OpenAI** : RSS officiel `openai.com/news/rss.xml`
- **Anthropic** : scraping HTML de `anthropic.com/news`, extraction des liens `/news/slug` + titre nearby
- **Kimi** : scraping HTML de `kimi.com/blog/`, avec fallback sur une liste connue d'articles
- Cache dans `AiNewsItem`

#### WeatherService (`weather.service.ts`)

- **OpenWeatherMap API** (cle dans `.env`)
- Meteo actuelle + previsions 5 jours (API free tier, 3h intervals agrege par jour)
- Cache dans `WeatherCache`
- Ville configurable dans les preferences (defaut: Caen)

#### AggregatorService (`aggregator.service.ts`)

- Orchestrateur central
- **Cron jobs** :
  - `*/30 * * * *` : refresh all
  - `*/5 * * * *` : check Twitch live
  - `*/15 * * * *` : refresh Trump
- **getDashboardData()** : appelle tous les services en parallele (`Promise.allSettled`), filtre Trump par criticite minimum, trie par relevance score
- **Scoring** : `score = 0.5 * recency + 0.3 * engagement + 0.2 * sourceWeight`

### Base de donnees (Prisma/SQLite)

```
UserPreference
├── weatherCity          (String, default "Caen")
├── twitchFollows        (String, CSV de logins)
├── twitchUsername        (String)
├── youtubeChannels      (String, CSV de handles)
├── twitterUsername       (String)
├── trumpMinCriticality  (Int, 0-10)
├── customRssFeeds       (String, URLs separees par newline)
└── refreshInterval      (Int, minutes)

TwitchStream
├── twitchId, title, thumbnailUrl, viewerCount
├── channelName, channelAvatar, gameName
├── isLive, url

YoutubeVideo
├── youtubeId, title, thumbnailUrl
├── channelName, channelAvatar, duration, views
├── url, isNew

Tweet
├── twitterId, authorName, authorHandle, authorAvatar
├── content, mediaUrl, likes, retweets

TrumpTweet
├── tweetId, content, type, criticality (0-10)
├── sentiment, keywords, likes, retweets
├── isBreaking, url, tweetDate

AiNewsItem
├── title, source (openai/anthropic/kimi)
├── url, summary, isNew

WeatherCache
├── city, temp, tempMin, tempMax, condition
├── wind, humidity, precipitation, icon
├── forecastDate, dayIndex

TwitchFollow (pour historique)
├── twitchUserId, channelId, channelName
├── channelAvatar, gameName, isLive
```

### Variables d'environnement (`server/.env`)

```env
PORT=3000
NODE_ENV=development
OPENWEATHERMAP_API_KEY=a74ad14a60941c71f4640e590912d3ac
DATABASE_URL="file:./dev.db"
```

Pas de cle API Twitch/YouTube/Twitter necessaire : tout est fait via scraping public, GQL public et RSS.

---

## Comment lancer

```bash
# Installation
npm install
cd server && npm install && npx prisma db push && cd ..

# Lancer tout
npm run dev:all
# Ou separement :
npm run start       # Frontend Angular sur :4200
npm run server      # Backend Express sur :3000
```

---

## Reference : NowStreaming

Snapshot minimal dans `references/NowStreaming/` conserve uniquement :
- `README.md`
- `popup.js`
- `LICENSE`

Il sert de reference pour la logique d'import Twitch. L'extension originale :
1. S'authentifie via OAuth Twitch (scope `user:read:follows`)
2. Resout username -> user ID via Helix API
3. Pagine les follows via `/helix/channels/followed?user_id=X&first=100`
4. Check les streams via `/helix/streams?user_login=X`
5. Affiche live/offline avec tri par viewers/uptime/jeu

NightHub reproduit ce comportement **sans OAuth** via le GQL public Twitch + import par collage de liste.
Les assets UI et le clone Git complet de la reference ont ete retires car ils n'etaient pas utilises par l'application.

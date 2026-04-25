# NightHub - Plan d'Implémentation Complet

## Statut — 25 avril 2026

### ✅ Complété
- Design system Neo-Noir Terminal (Stitch) : fonts, couleurs, neo-glass, label-caps
- Header fixe avec météo, stats, status LEDs
- Popup météo 7 jours
- YouTube Recap : vignettes, vues, date relative, durée overlay, popup + side panel
- Filtre Shorts par durée (YouTube Data API v3) + heuristiques #shorts/URL
- Architecture cache-first YouTube : dashboard répond en <200ms, refresh en background parallèle
- Script extraction abonnements YouTube (`scripts/youtube-subscriptions.js`)
- Script extraction follows X (`scripts/x-follows.js`)
- Script extraction follows Twitch (`scripts/twitch-follows.js`)
- Flux RSS personnalisés dans les préférences
- Twitch side panel push (sans backdrop, décale le dashboard)
- Weather preferences (ville configurable)

### ⚙️ Configuration requise
- `YOUTUBE_API_KEY` dans `server/.env` pour : durées des vidéos + filtre Shorts par durée

### 🔄 Limites connues
- Nitter peut retourner 429 (rate limit) → fallback cache
- Avatars YouTube = URLs génériques (pas les vrais avatars)
- Filtre Shorts sans API key = heuristique seulement (#shorts dans le titre)

---

## ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Angular 21)                       │
│   Dashboard ← → ApiService ← → State Management (Signals)         │
└────────────────────────────┬───────────────────────────────────────┘
                             │ HTTP (REST)
┌────────────────────────────▼───────────────────────────────────────┐
│                     BACKEND (Express + Node.js)                     │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│   │ YouTube API │  │ Twitch API  │  │ Twitter API │               │
│   │  OAuth2     │  │  OAuth2     │  │  Bearer     │               │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│          │                │                │                      │
│          └────────────────┼────────────────┘                       │
│                           ↓                                        │
│              ┌────────────────────────┐                            │
│              │   DataAggregator        │                            │
│              │   + RelevanceScore      │                            │
│              └───────────┬────────────┘                            │
└──────────────────────────┼────────────────────────────────────────┘
                           ↓
┌──────────────────────────▼────────────────────────────────────────┐
│                    DATABASE (SQLite + Prisma)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ tweets   │ │ streams  │ │ videos   │ │ news     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │ oauth_tokens    │  │ user_preferences │                      │
│  └──────────────────┘  └──────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

## CHOIX TECHNIQUES

| Composant | Choix | Justification |
|-----------|-------|---------------|
| **Database** | SQLite + Prisma | Local, zero-config, performant, Type-safe |
| **Backend** | Express.js | Simplicité, déjà dans package.json |
| **Auth** | OAuth2 popup pour YouTube/Twitch | Standard, sécurisé |
| **YouTube** | Google OAuth2 | API YouTube Data v3 |
| **Twitch** | Twitch OAuth2 | Helix API |
| **Twitter/X** | Twitter Bearer Token | API v2 |
| **Scraper** | RSS pour AI news | Simple et efficace |
| **Scheduling** | node-cron | Refresh données automatique |
| **CORS** | cors middleware | Backend <-> Frontend |

## API ENDPOINTS BACKEND

```
GET  /health                           → Health check
GET  /api/auth/youtube                → Start YouTube OAuth popup
GET  /api/auth/youtube/callback       → OAuth callback, close popup
GET  /api/auth/twitch                 → Start Twitch OAuth popup
GET  /api/auth/twitch/callback        → OAuth callback, close popup
GET  /api/auth/status                 → { youtube: bool, twitch: bool }
POST /api/auth/logout                 → Clear tokens for provider

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
```

## VARIABLES D'ENVIRONNEMENT (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# YouTube OAuth
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Twitch OAuth
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/twitch/callback

# Twitter Bearer Token
TWITTER_BEARER_TOKEN=your_bearer_token

# OpenWeatherMap (weather)
OPENWEATHERMAP_API_KEY=a74ad14a60941c71f4640e590912d3ac

# Prisma
DATABASE_URL="file:./dev.db"
```

## RSS FEEDS AI NEWS

- Anthropic: https://www.anthropic.com/news.rss
- OpenCode: https://opencode.ai/blog/rss.xml
- Kimi: https://kimi.moonshot.cn/blog/rss

## SCORING ALGORITHM

```javascript
score = (
  recencyWeight * (1 - ageHours/maxAge) +
  engagementWeight * normalizedEngagement +
  sourceWeight * sourceMultiplier
)

// Weights: recency=0.5, engagement=0.3, source=0.2
// maxAge: 24h tweets, 7d videos, 1h news
```

## CRON JOBS

- Every 30 min: Refresh all data sources
- Every 5 min: Check Twitch live status
- Cache TTL: 1h for news, 30min for streams/videos

## DEFAULT CONFIG

| Setting | Value |
|---------|-------|
| Weather City | Caen |
| Refresh Interval | 30 minutes |
| YouTube Subscriptions | User's personal subscriptions |
| Twitch Follows | User's personal follows |
| Twitter Timeline | User's personal timeline |

## BACKEND STRUCTURE

```
server/
├── prisma/
│   └── schema.prisma            # Database schema
├── src/
│   ├── config/
│   │   └── env.ts              # Environment variables
│   ├── routes/
│   │   ├── health.routes.ts    # Health check
│   │   ├── auth.routes.ts      # OAuth flows
│   │   └── api.routes.ts       # All API endpoints
│   ├── controllers/
│   │   ├── youtube.controller.ts
│   │   ├── twitch.controller.ts
│   │   ├── twitter.controller.ts
│   │   ├── weather.controller.ts
│   │   └── news.controller.ts
│   ├── services/
│   │   ├── youtube.service.ts
│   │   ├── twitch.service.ts
│   │   ├── twitter.service.ts
│   │   ├── weather.service.ts
│   │   ├── news.service.ts
│   │   └── aggregator.service.ts
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   └── cors.middleware.ts
│   ├── db/
│   │   └── prisma.client.ts
│   └── app.ts
├── .env.example
└── package.json
```

## FRONTEND CHANGES

1. **ApiService** - HttpClient to backend
2. **Settings page** - OAuth popup buttons for YouTube/Twitch
3. **Guard inputs** - All components with input.required → guards added
4. **Dashboard** - Uses backend API instead of mock data

## IMPLEMENTATION PHASES

1. Backend Express + Prisma + SQLite
2. OAuth services (YouTube, Twitch) with popup flow
3. Data services (Twitter, Weather, News)
4. Aggregator + scoring + cron jobs
5. Frontend integration with guards
6. Tests
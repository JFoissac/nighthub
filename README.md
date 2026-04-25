# NightHub

A full-stack dashboard aggregating AI news, Twitter/X, YouTube, Twitch, and weather data.

## Quick Start

### First Time Setup

```bash
# Install all dependencies and set up database
npm run db:setup
```

### Run Everything (Frontend + Backend)

```bash
npm run dev:all
```

This starts:
- **Frontend**: http://localhost:4200 (Angular/NX)
- **Backend**: http://localhost:3000 (Express/Node)

### Individual Commands

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
npm run server:install

# Generate Prisma client for backend
npm run server:db:generate

# Create/update database schema
npm run server:db:push

# Start backend only
npm run server

# Start frontend only
npm start

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build
```

## Configuration

### Backend (.env)

Create `server/.env` with your API credentials:

```env
PORT=3000
NODE_ENV=development

# OAuth credentials (optional - for YouTube/Twitch integration)
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/twitch/callback

# External APIs
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key

# Database
DATABASE_URL="file:./dev.db"
```

### OAuth Setup (Optional)

To enable YouTube/Twitch connections:

**YouTube:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Add redirect URI: `http://localhost:3000/api/auth/youtube/callback`

**Twitch:**
1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Register application with redirect URI: `http://localhost:3000/api/auth/twitch/callback`

## Architecture

```
nighthub/
├── server/                 # Express backend
│   ├── prisma/            # Database schema
│   │   └── schema.prisma  # SQLite with Prisma ORM
│   └── src/
│       ├── app.ts         # Entry point
│       ├── config/        # Environment config
│       ├── db/            # Prisma client
│       ├── routes/        # API & auth routes
│       └── services/      # Business logic
└── src/                   # Angular frontend
    └── app/
        ├── components/    # Reusable UI components
        ├── pages/         # Page components
        └── services/      # API client services
```

## Features

- **AI News**: Aggregates from multiple AI-focused RSS feeds
- **Twitter/X**: Displays timeline with tweets
- **YouTube**: Shows latest videos from subscribed channels
- **Twitch**: Live streams from followed streamers
- **Weather**: Current conditions for Caen (configurable)
- **OAuth**: Connect YouTube/Twitch accounts via popup

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/dashboard` | All dashboard data |
| GET | `/api/weather?city=Caen` | Weather for city |
| GET | `/api/news?limit=20` | AI news items |
| GET | `/api/tweets?limit=20` | Twitter timeline |
| GET | `/api/streams` | Twitch streams |
| GET | `/api/videos` | YouTube videos |
| POST | `/api/refresh/all` | Refresh all data |
| GET | `/api/auth/status` | OAuth connection status |
| GET | `/api/auth/youtube` | Start YouTube OAuth |
| GET | `/api/auth/twitch` | Start Twitch OAuth |

## Data Refresh Schedule

- Every 30 minutes: Full refresh of all data
- Every 5 minutes: Twitch stream status check

## Troubleshooting

### Backend won't start

```bash
cd server
npm run db:generate
npm run db:push
npm run dev
```

### Frontend build fails

```bash
rm -rf node_modules/.cache dist
npm run build
```

### Tests failing

```bash
npx nx test --watch=false
```

## Scripts utilitaires

| Script | Usage |
|--------|-------|
| `scripts/youtube-subscriptions.js` | Extraire vos abonnements YouTube depuis `youtube.com/feed/channels` |
| `scripts/x-follows.js` | Extraire vos follows X depuis `x.com/{pseudo}/following` |
| `scripts/twitch-follows.js` | Extraire vos follows Twitch (GQL, requiert d'être connecté sur twitch.tv) |

Pour chaque script : ouvrir la console Chrome (F12), coller le contenu, patienter. Le résultat est copié automatiquement dans le presse-papier.

### YouTube — `youtube-subscriptions.js`

  1. Aller sur https://www.youtube.com/feed/channels
  2. F12 → Console → coller le script
  3. Scroll automatique (~30 sec selon le nombre d'abonnements)
  4. Génère un CSV au format Google Takeout (Channel Id,Channel Url,Channel Title)
  5. NightHub → Settings → YouTube → bouton Google Takeout CSV → importer

### Filtre Shorts — `youtube.service.ts`

  Détecte les Shorts via : titre contient #shorts/#short, URL contient /shorts/, ou durée < 60s (nécessite `YOUTUBE_API_KEY`).

  YouTube Recap amélioré — video-card.component.ts

  - Nom du youtubeur en cyan label-caps
  - Vues : 12K vues, 1.4M vues
  - Date relative : aujourd'hui, hier, il y a 3j, il y a 2sem
  - Clic → popup player (plus de <a href> direct)

  Popup vidéo — video-player-popup.component.ts

  - Modal centré avec iframe YouTube embed (autoplay=1)
  - Bouton SIDE PANEL → ferme le popup et ouvre le side panel
  - Bouton YOUTUBE → ouvre dans un onglet

  Side Panel vidéo — video-player-panel.component.ts

  - Même comportement que le Twitch side panel (glisse depuis la droite)
  - Persiste pendant la navigation dans le dashboard
  - Fermeture : backdrop, bouton X, ou Escape
  - Le Twitch panel et le YouTube panel partagent le même pattern
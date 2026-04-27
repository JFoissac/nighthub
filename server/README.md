# NightHub Backend

Backend API server for NightHub dashboard. Handles OAuth authentication, data aggregation, and caching.

## Prerequisites

- Node.js 18+
- npm or pnpm

## Installation

```bash
cd server
npm install
```

## Configuration

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# YouTube OAuth
YOUTUBE_CLIENT_ID=your_youtube_client_id
YOUTUBE_CLIENT_SECRET=your_youtube_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Twitch OAuth
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/twitch/callback

# Twitter Bearer Token
TWITTER_BEARER_TOKEN=your_twitter_bearer_token

# OpenWeatherMap API Key
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key

# Database (SQLite)
DATABASE_URL="file:./dev.db"
```

## Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Create database schema
npm run db:push

# (Optional) Run migrations
npm run db:migrate
```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `GET /api/auth/youtube` - Start YouTube OAuth flow
- `GET /api/auth/youtube/callback` - YouTube OAuth callback
- `GET /api/auth/twitch` - Start Twitch OAuth flow
- `GET /api/auth/twitch/callback` - Twitch OAuth callback
- `GET /api/auth/status` - Check OAuth connection status
- `POST /api/auth/logout` - Disconnect OAuth provider

### Data API
- `GET /api/dashboard` - Get all dashboard data
- `GET /api/weather?city=Caen` - Get weather for city
- `GET /api/news?limit=20` - Get AI news
- `GET /api/tweets?limit=20` - Get Twitter timeline
- `GET /api/streams` - Get Twitch streams
- `GET /api/videos` - Get YouTube videos

### Refresh Endpoints
- `POST /api/refresh/all` - Refresh all data
- `POST /api/refresh/news` - Refresh AI news only
- `POST /api/refresh/twitch` - Refresh Twitch streams only

## OAuth Setup

### YouTube

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:3000/api/auth/youtube/callback`
6. Copy Client ID and Client Secret to `.env`

### Twitch

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console)
2. Register a new application
3. Add OAuth redirect URI: `http://localhost:3000/api/auth/twitch/callback`
4. Copy Client ID and Client Secret to `.env`
5. Generate Client Secret if not already done

## Architecture

```
server/
├── prisma/
│   └── schema.prisma     # Database schema
├── src/
│   ├── app.ts            # Express app entry point
│   ├── config/
│   │   └── env.ts        # Environment configuration
│   ├── db/
│   │   └── prisma.client.ts  # Prisma client singleton
│   ├── middleware/
│   │   └── error.middleware.ts
│   ├── routes/
│   │   ├── api.routes.ts     # Data API routes
│   │   ├── auth.routes.ts    # OAuth routes
│   │   └── health.routes.ts  # Health check routes
│   └── services/
│       ├── aggregator.service.ts  # Data aggregation & cron jobs
│       ├── news.service.ts        # AI news RSS feeds
│       ├── twitter.service.ts     # Twitter API
│       ├── twitch.service.ts      # Twitch API
│       ├── weather.service.ts     # OpenWeatherMap
│       └── youtube.service.ts     # YouTube API
└── .env                  # Environment variables (create this)
```

## Data Refresh Schedule

- **Every 30 minutes**: Refresh all data (weather, news, tweets, videos, streams)
- **Every 5 minutes**: Check Twitch streams for live status

## Troubleshooting

### Database errors
```bash
# Reset database
rm -f prisma/dev.db
npm run db:push
```

### OAuth callback not working
- Verify redirect URIs in OAuth provider settings match exactly
- Check browser console for CORS errors
- Ensure server is running on port 3000
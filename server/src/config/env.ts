import dotenv from 'dotenv';

dotenv.config();

const rawCorsOrigins = process.env.CORS_ORIGINS || 'http://localhost:4200,http://127.0.0.1:4200,http://localhost:4201,http://127.0.0.1:4201';
const allowedOrigins = rawCorsOrigins.split(',').map((o) => o.trim()).filter(Boolean);

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  cors: {
    origins: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },

  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/auth/youtube/callback',
  },

  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID || '',
    clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
    redirectUri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/api/auth/twitch/callback',
  },

  openWeatherMap: {
    apiKey: process.env.OPENWEATHERMAP_API_KEY || '',
  },

  piped: {
    instanceUrl: process.env.PIPED_INSTANCE_URL || '',
  },

  coingecko: {
    apiKey: process.env.COINGECKO_API_KEY || '',
  },

  alphaVantage: {
    apiKey: process.env.ALPHA_VANTAGE_API_KEY || '',
  },

  newsApi: {
    apiKey: process.env.NEWS_API_KEY || '',
  },

  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
};

export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}

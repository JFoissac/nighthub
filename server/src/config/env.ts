import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

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

  twitter: {
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
    bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    redirectUri: process.env.TWITTER_REDIRECT_URI || 'http://localhost:3000/api/auth/twitter/callback',
  },

  openWeatherMap: {
    apiKey: process.env.OPENWEATHERMAP_API_KEY || '',
  },

  piped: {
    instanceUrl: process.env.PIPED_INSTANCE_URL || '',
  },

  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
};

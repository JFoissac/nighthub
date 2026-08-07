import { Router } from 'express';
import dashboardRoutes from './dashboard.routes';
import youtubeRoutes from './youtube.routes';
import twitchRoutes from './twitch.routes';
import newsRoutes from './news.routes';
import preferencesRoutes from './preferences.routes';
import marketRoutes from './market.routes';
import { validateCity, validateLimit } from './route.utils';
import { weatherService, trumpService, youtubeService, trumpNewsService } from '../services/backend.runtime';
import { logger } from '../utils/logger';

async function getTrump(req: any, res: any) {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await trumpService.getCachedTrumpTweets(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Trump tweets' });
  }
}

async function refreshTrump(_req: any, res: any) {
  try {
    const tweets = await trumpService.fetchTrumpTweets(20);
    res.json({ success: true, count: tweets.length });
  } catch (error) {
    logger.error('Refresh Trump failed', error, { route: '/refresh/trump' });
    res.status(500).json({ error: 'Failed to refresh Trump tweets' });
  }
}

async function getTrumpNews(req: any, res: any) {
  try {
    const limit = validateLimit(req.query.limit);
    const items = await trumpNewsService.getCachedTrumpNews(limit);
    res.json(items);
  } catch (error) {
    logger.error('Get Trump news failed', error, { route: '/trump/news' });
    res.status(500).json({ error: 'Failed to fetch Trump news' });
  }
}

async function refreshTrumpNews(_req: any, res: any) {
  try {
    const items = await trumpNewsService.fetchTrumpNews(20);
    res.json({ success: true, count: items.length });
  } catch (error) {
    logger.error('Refresh Trump news failed', error, { route: '/refresh/trump-news' });
    res.status(500).json({ error: 'Failed to refresh Trump news' });
  }
}

async function getWeather(req: any, res: any) {
  try {
    const city = validateCity(req.query.city);
    const forecast = await weatherService.getWeeklyForecast(city);
    if (forecast && forecast.source === 'error') {
      res.status(503).json(forecast);
      return;
    }
    res.json(forecast);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
}

async function getVideos(req: any, res: any) {
  try {
    const limit = validateLimit(req.query.limit);
    const videos = await youtubeService.getLatestVideos(limit);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}

export function createApiRouter() {
  const router = Router();

  router.use(dashboardRoutes);
  router.use('/youtube', youtubeRoutes);
  router.use('/twitch', twitchRoutes);
  router.use(newsRoutes);
  router.use(preferencesRoutes);
  router.use('/market', marketRoutes);
  router.get('/videos', getVideos);
  router.get('/trump', getTrump);
  router.get('/trump/news', getTrumpNews);
  router.get('/weather', getWeather);
  router.post('/refresh/trump', refreshTrump);
  router.post('/refresh/trump-news', refreshTrumpNews);

  return router;
}

export default createApiRouter();

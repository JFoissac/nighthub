import { Router, Request, Response } from 'express';
import { marketService, marketIntelService } from '../services/backend.runtime';
import { logger } from '../utils/logger';

const router = Router();

async function getMarketLive(_req: Request, res: Response) {
  try {
    const data = await marketService.getLiveMarketData();
    res.json(data);
  } catch (err) {
    logger.error('[Market] Route error', err);
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
}

async function getFearGreed(_req: Request, res: Response) {
  try {
    res.json(await marketIntelService.getFearGreed());
  } catch (err) {
    logger.error('[Market] Fear&Greed route error', err);
    res.status(500).json({ error: 'Failed to fetch fear & greed' });
  }
}

async function getMarketSentiment(_req: Request, res: Response) {
  try {
    res.json(await marketIntelService.getMarketSentiment());
  } catch (err) {
    logger.error('[Market] Sentiment route error', err);
    res.status(500).json({ error: 'Failed to fetch market sentiment' });
  }
}

async function getMarketNews(_req: Request, res: Response) {
  try {
    res.json(await marketIntelService.getMarketNews());
  } catch (err) {
    logger.error('[Market] News route error', err);
    res.status(500).json({ error: 'Failed to fetch market news' });
  }
}

router.get('/live', getMarketLive);
router.get('/fear-greed', getFearGreed);
router.get('/sentiment', getMarketSentiment);
router.get('/news', getMarketNews);

export default router;

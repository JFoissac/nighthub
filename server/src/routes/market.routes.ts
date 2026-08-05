import { Router, Request, Response } from 'express';
import { marketService } from '../services/backend.runtime';
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

router.get('/live', getMarketLive);

export default router;

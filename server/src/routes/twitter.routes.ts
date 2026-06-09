import { Router, Request, Response } from 'express';
import { twitterService } from '../services/twitter.service';
import { trumpService } from '../services/trump.service';

const router = Router();

const validateLimit = (limit: any): number => {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return 20;
  if (parsed > 100) return 100;
  return parsed;
};

async function getTweets(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await twitterService.getTimeline(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
}

async function getTrump(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const tweets = await trumpService.getCachedTrumpTweets(limit);
    res.json(tweets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Trump tweets' });
  }
}

async function refreshTrump(_req: Request, res: Response) {
  try {
    const tweets = await trumpService.fetchTrumpTweets(20);
    res.json({ success: true, count: tweets.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh Trump tweets' });
  }
}

async function getTwitterAccountStats(_req: Request, res: Response) {
  try {
    const { prisma } = await import('../db/prisma.client');
    const accounts = await twitterService.getTwitterAccounts();
    if (!accounts.length) {
      return res.json([]);
    }
    const stats = await prisma.$queryRaw<{ authorHandle: string; lastSeen: string }[]>`
      SELECT authorHandle, MAX(fetchedAt) as lastSeen FROM Tweet GROUP BY authorHandle
    `;
    const statsMap = new Map(stats.map(s => [
      s.authorHandle.replace('@', '').toLowerCase(),
      new Date(s.lastSeen),
    ]));
    const result = accounts.map(handle => {
      const d = statsMap.get(handle.toLowerCase());
      return {
        handle,
        lastSeen: d ? d.toISOString() : null,
        inactive: !d || (Date.now() - d.getTime()) > 7 * 24 * 60 * 60 * 1000,
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Twitter account stats' });
  }
}

router.get('/tweets', getTweets);
router.get('/trump', getTrump);
router.post('/refresh/trump', refreshTrump);
router.get('/twitter/account-stats', getTwitterAccountStats);

export default router;
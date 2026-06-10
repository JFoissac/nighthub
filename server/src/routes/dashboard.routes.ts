import { Router, Request, Response } from 'express';
import { aggregatorService } from '../services/aggregator.service';
import { validateLimit } from './route.utils';
import { logger } from '../utils/logger';

const router = Router();

async function getDashboard(_req: Request, res: Response) {
  try {
    const data = await aggregatorService.getDashboardData();
    res.json(data);
  } catch (error) {
    logger.error('Dashboard fetch failed', error, { route: '/dashboard' });
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}

async function getDashboardStream(_req: Request, res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const sendEvent = (data: any, event?: string) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  heartbeatId = setInterval(() => {
    sendEvent({ ts: Date.now() }, 'heartbeat');
  }, 4000);

  try {
    const data = await aggregatorService.getDashboardData((step: string) => {
      sendEvent({ step }, 'progress');
    });
    sendEvent(data, 'dashboard');
  } catch (error) {
    logger.error('Dashboard SSE failed', error, { route: '/dashboard/stream' });
    sendEvent({ error: 'Failed to fetch dashboard data' }, 'error');
  } finally {
    if (heartbeatId) clearInterval(heartbeatId);
    res.end();
  }
}

async function refreshAll(_req: Request, res: Response) {
  try {
    await aggregatorService.refreshAll();
    res.json({ success: true, message: 'Refresh initiated' });
  } catch (error) {
    logger.error('Refresh all failed', error, { route: '/refresh/all' });
    res.status(500).json({ error: 'Failed to refresh' });
  }
}

async function refreshTwitch(_req: Request, res: Response) {
  try {
    await aggregatorService.refreshTwitch();
    res.json({ success: true });
  } catch (error) {
    logger.error('Refresh Twitch failed', error, { route: '/refresh/twitch' });
    res.status(500).json({ error: 'Failed to refresh Twitch' });
  }
}

async function getStreams(_req: Request, res: Response) {
  try {
    const { twitchService } = await import('../services/twitch.service');
    const streams = await twitchService.getFollowedStreams();
    res.json(streams);
  } catch (error) {
    logger.error('Streams fetch failed', error, { route: '/streams' });
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
}

async function getFollows(req: Request, res: Response) {
  try {
    const { twitchService } = await import('../services/twitch.service');
    const username = req.query.username as string;
    if (username) {
      const follows = await twitchService.getFollowsByProfile(username);
      res.json(follows);
    } else {
      const follows = await twitchService.getFollows();
      res.json(follows);
    }
  } catch (error) {
    logger.error('Follows fetch failed', error, { route: '/follows' });
    res.status(500).json({ error: 'Failed to fetch follows' });
  }
}

router.get('/dashboard', getDashboard);
router.get('/dashboard/stream', getDashboardStream);
router.post('/refresh/all', refreshAll);
router.post('/refresh/twitch', refreshTwitch);
router.get('/streams', getStreams);
router.get('/follows', getFollows);

export default router;

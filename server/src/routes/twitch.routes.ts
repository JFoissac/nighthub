import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { twitchService } from '../services/backend.runtime';
import { validateBody } from './route.utils';

const router = Router();

const twitchImportSchema = z.object({ channels: z.array(z.string()) });

async function getStreams(_req: Request, res: Response) {
  try {
    const streams = await twitchService.getFollowedStreams();
    res.json(streams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams' });
  }
}

async function getFollows(req: Request, res: Response) {
  try {
    const username = req.query.username as string;
    if (username) {
      const follows = await twitchService.getFollowsByProfile(username);
      res.json(follows);
    } else {
      const follows = await twitchService.getFollows();
      res.json(follows);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch follows' });
  }
}

async function importTwitchList(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof twitchImportSchema>;
    const result = await twitchService.importFollowsFromList(channels);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to import channel list' });
  }
}

router.get('/streams', getStreams);
router.get('/follows', getFollows);
router.post('/import-list', validateBody(twitchImportSchema), importTwitchList);

export default router;

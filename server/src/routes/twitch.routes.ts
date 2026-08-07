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

async function getPlayback(req: Request, res: Response) {
  try {
    const channel = String(req.query.channel || '').trim().toLowerCase();
    if (!channel) {
      res.status(400).json({ error: 'channel query param is required' });
      return;
    }
    // Viewer-authenticated playback token when the Twitch account is linked
    // (removes preroll ads for Twitch Turbo/Prime), anonymous otherwise.
    const result = await twitchService.getPlaybackToken(channel);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get playback token' });
  }
}

router.get('/streams', getStreams);
router.get('/follows', getFollows);
router.post('/import-list', validateBody(twitchImportSchema), importTwitchList);
router.get('/playback', getPlayback);

export default router;

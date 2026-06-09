import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { youtubeService } from '../services/youtube.service';

const router = Router();

const validateLimit = (limit: any): number => {
  const parsed = parseInt(limit, 10);
  if (isNaN(parsed) || parsed < 1) return 20;
  if (parsed > 100) return 100;
  return parsed;
};

const youtubeImportListSchema = z.object({ channels: z.array(z.string()) });
const youtubeImportTakeoutSchema = z.object({ channels: z.array(z.object({ channelId: z.string() })) });
const youtubeRemapSchema = z.object({
  handle: z.string().min(1),
  channelId: z.string().min(1),
});

function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: Function): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
      return;
    }
    (req as any).validatedBody = parsed.data as z.infer<T>;
    next();
  };
}

async function getVideos(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const videos = await youtubeService.getLatestVideos(limit);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
}

async function importYoutubeList(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof youtubeImportListSchema>;
    const cleaned = channels
      .map((c: string) => c.trim())
      .filter((c: string) => c.length > 0)
      .map((c: string) => c.startsWith('@') ? c : `@${c}`);

    const existing = await youtubeService.getChannelHandles();
    const merged = [...new Set([...existing, ...cleaned])];
    await youtubeService.saveChannelHandles(merged);

    res.json({ imported: cleaned.length, channels: merged });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import YouTube channels' });
  }
}

async function importYoutubeTakeout(req: Request, res: Response) {
  try {
    const { channels } = (req as any).validatedBody as z.infer<typeof youtubeImportTakeoutSchema>;
    const valid = channels.filter((c: any) =>
      typeof c.channelId === 'string' && /^UC[a-zA-Z0-9_-]{22}$/.test(c.channelId)
    );
    const existing = await youtubeService.getChannelIds();
    const newIds = valid.map((c: any) => c.channelId as string);
    const merged = [...new Set([...existing, ...newIds])];
    await youtubeService.saveChannelIds(merged);
    res.json({ imported: valid.length, total: merged.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import YouTube channels from Takeout' });
  }
}

async function getYoutubeRemapReport(_req: Request, res: Response) {
  try {
    const report = await youtubeService.getRemapReport();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to build YouTube remap report' });
  }
}

async function searchYoutubeChannels(req: Request, res: Response) {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    if (query.length < 2) {
      res.status(400).json({ error: 'Query must be at least 2 characters' });
      return;
    }
    const candidates = await youtubeService.searchChannelsByName(query);
    res.json({ query, candidates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search YouTube channels' });
  }
}

async function remapYoutubeChannel(req: Request, res: Response) {
  try {
    const { handle, channelId } = (req as any).validatedBody as z.infer<typeof youtubeRemapSchema>;
    const result = await youtubeService.remapHandleToChannelId(handle, channelId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    if (error?.message === 'Invalid handle' || error?.message === 'Invalid channelId') {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to remap YouTube channel' });
  }
}

router.get('/videos', getVideos);
router.post('/import-list', validateBody(youtubeImportListSchema), importYoutubeList);
router.post('/import-takeout', validateBody(youtubeImportTakeoutSchema), importYoutubeTakeout);
router.get('/remap/report', getYoutubeRemapReport);
router.get('/remap/search', searchYoutubeChannels);
router.post('/remap', validateBody(youtubeRemapSchema), remapYoutubeChannel);

export default router;
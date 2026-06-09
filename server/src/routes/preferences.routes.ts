import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.client';
import { youtubeService } from '../services/youtube.service';

const router = Router();

const preferencesSchema = z.object({
  weatherCity: z.string().optional(),
  twitchFollows: z.string().optional(),
  twitchUsername: z.string().optional(),
  youtubeChannels: z.string().optional(),
  youtubeChannelIds: z.string().optional(),
  twitterUsername: z.string().optional(),
  twitterAccounts: z.string().optional(),
  trumpMinCriticality: z.number().optional(),
  customRssFeeds: z.string().optional(),
  refreshInterval: z.number().optional(),
  themeOledBlack: z.boolean().optional(),
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

async function getPreferences(_req: Request, res: Response) {
  try {
    let pref = await prisma.userPreference.findFirst();
    if (!pref) {
      pref = await prisma.userPreference.create({ data: {} });
    }
    res.json({
      weatherCity: pref.weatherCity,
      twitchFollows: pref.twitchFollows,
      twitchUsername: pref.twitchUsername,
      youtubeChannels: pref.youtubeChannels,
      youtubeChannelIds: pref.youtubeChannelIds,
      twitterUsername: pref.twitterUsername,
      twitterAccounts: pref.twitterAccounts,
      trumpMinCriticality: pref.trumpMinCriticality,
      customRssFeeds: pref.customRssFeeds,
      refreshInterval: pref.refreshInterval,
      themeOledBlack: pref.themeOledBlack,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
}

async function savePreferences(req: Request, res: Response) {
  try {
    const body = (req as any).validatedBody as z.infer<typeof preferencesSchema>;

    const data: Record<string, any> = {};
    let handledYoutubeChannels = false;

    if (typeof body.weatherCity === 'string') data.weatherCity = body.weatherCity.substring(0, 50);
    if (typeof body.twitchFollows === 'string') data.twitchFollows = body.twitchFollows.substring(0, 10000);
    if (typeof body.twitchUsername === 'string') data.twitchUsername = body.twitchUsername.substring(0, 50);
    if (typeof body.youtubeChannels === 'string') {
      const handles = body.youtubeChannels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await youtubeService.saveChannelHandles(handles);
      handledYoutubeChannels = true;
    }
    if (typeof body.youtubeChannelIds === 'string' && !handledYoutubeChannels) {
      data.youtubeChannelIds = body.youtubeChannelIds.substring(0, 50000);
    }
    if (typeof body.twitterUsername === 'string') data.twitterUsername = body.twitterUsername.substring(0, 100);
    if (typeof body.twitterAccounts === 'string') data.twitterAccounts = body.twitterAccounts.substring(0, 50000);
    if (typeof body.trumpMinCriticality === 'number') data.trumpMinCriticality = Math.max(0, Math.min(10, body.trumpMinCriticality));
    if (typeof body.customRssFeeds === 'string') data.customRssFeeds = body.customRssFeeds.substring(0, 10000);
    if (typeof body.refreshInterval === 'number') data.refreshInterval = Math.max(5, Math.min(60, body.refreshInterval));
    if (typeof body.themeOledBlack === 'boolean') data.themeOledBlack = body.themeOledBlack;

    const existing = await prisma.userPreference.findFirst();
    if (existing) {
      await prisma.userPreference.update({ where: { id: existing.id }, data });
    } else {
      await prisma.userPreference.create({ data });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
}

router.get('/preferences', getPreferences);
router.post('/preferences', validateBody(preferencesSchema), savePreferences);

export default router;
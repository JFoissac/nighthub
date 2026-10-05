import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.client';
import { aggregatorService, youtubeService } from '../services/backend.runtime';
import { validateBody } from './route.utils';

const router = Router();

// Correctif 05/10/2026 (audit) — le schéma ne déclarait que `refreshInterval`, alors que le modèle
// Prisma porte 5 fréquences distinctes (market/trump/news/streams/youtube). Un `z.object()` SUPPRIME les
// clés non déclarées : ces 5 préférences n'étaient donc ni enregistrables ni renvoyées — l'utilisateur
// pouvait les régler dans l'interface sans que rien ne soit conservé.
const FRAICHEUR = z.number().int().min(5).max(1440).optional();
const preferencesSchema = z.object({
  weatherCity: z.string().optional(),
  twitchFollows: z.string().optional(),
  twitchUsername: z.string().optional(),
  youtubeChannels: z.string().optional(),
  youtubeChannelIds: z.string().optional(),
  trumpMinCriticality: z.number().optional(),
  customRssFeeds: z.string().optional(),
  refreshInterval: z.number().optional(),
  themeOledBlack: z.boolean().optional(),
  marketRefreshInterval: FRAICHEUR,
  trumpRefreshInterval: FRAICHEUR,
  newsRefreshInterval: FRAICHEUR,
  streamsRefreshInterval: FRAICHEUR,
  youtubeRefreshInterval: FRAICHEUR,
});

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
      trumpMinCriticality: pref.trumpMinCriticality,
      customRssFeeds: pref.customRssFeeds,
      refreshInterval: pref.refreshInterval,
      themeOledBlack: pref.themeOledBlack,
      // les 5 fréquences par domaine étaient omises de la réponse (correctif 05/10/2026)
      marketRefreshInterval: pref.marketRefreshInterval,
      trumpRefreshInterval: pref.trumpRefreshInterval,
      newsRefreshInterval: pref.newsRefreshInterval,
      streamsRefreshInterval: pref.streamsRefreshInterval,
      youtubeRefreshInterval: pref.youtubeRefreshInterval,
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
    if (typeof body.trumpMinCriticality === 'number') data.trumpMinCriticality = Math.max(0, Math.min(10, body.trumpMinCriticality));
    if (typeof body.customRssFeeds === 'string') data.customRssFeeds = body.customRssFeeds.substring(0, 10000);
    if (typeof body.refreshInterval === 'number') data.refreshInterval = Math.max(5, Math.min(60, body.refreshInterval));
    if (typeof body.themeOledBlack === 'boolean') data.themeOledBlack = body.themeOledBlack;
    // Les 5 fréquences par domaine : bornées des deux côtés (le schéma valide 5..1440 en amont).
    for (const cle of ['marketRefreshInterval', 'trumpRefreshInterval', 'newsRefreshInterval',
      'streamsRefreshInterval', 'youtubeRefreshInterval'] as const) {
      const v = (body as Record<string, unknown>)[cle];
      if (typeof v === 'number') data[cle] = Math.max(5, Math.min(1440, v));
    }

    const existing = await prisma.userPreference.findFirst();
    if (existing) {
      await prisma.userPreference.update({ where: { id: existing.id }, data });
    } else {
      await prisma.userPreference.create({ data });
    }
    // Preferences changed: drop the cached dashboard snapshot so the next
    // load reflects the new settings (city, feeds, criticality, ...).
    aggregatorService.invalidateDashboardCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save preferences' });
  }
}

router.get('/preferences', getPreferences);
router.post('/preferences', validateBody(preferencesSchema), savePreferences);

export default router;

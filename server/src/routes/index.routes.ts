import { Router } from 'express';
import dashboardRoutes from './dashboard.routes';
import youtubeRoutes from './youtube.routes';
import twitchRoutes from './twitter.routes';
import newsRoutes from './news.routes';
import twitterRoutes from './twitter.routes';
import preferencesRoutes from './preferences.routes';

const router = Router();

router.use(dashboardRoutes);
router.use(youtubeRoutes);
router.use(twitchRoutes);
router.use(newsRoutes);
router.use(twitterRoutes);
router.use(preferencesRoutes);

export default router;
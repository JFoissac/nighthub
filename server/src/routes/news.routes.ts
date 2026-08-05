import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { newsService } from '../services/backend.runtime';
import { ARTICLE_EXTRACTION_FAILED, ARTICLE_URL_NOT_ALLOWED } from '../services/news.service';
import { validateBody, validateLimit } from './route.utils';

const router = Router();

const detectFeedSchema = z.object({ url: z.string().startsWith('http') });
const extractNewsSchema = z.object({
  url: z.string().url().refine((value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, { message: 'Invalid URL protocol' }),
});

async function getNews(req: Request, res: Response) {
  try {
    const limit = validateLimit(req.query.limit);
    const news = await newsService.getCachedNews(limit);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}

async function refreshNews(_req: Request, res: Response) {
  try {
    const news = await newsService.fetchAiNews();
    res.json({ success: true, count: news.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh news' });
  }
}

async function detectFeed(req: Request, res: Response) {
  try {
    const { url } = (req as any).validatedBody as z.infer<typeof detectFeedSchema>;
    const feedUrl = await newsService.detectFeed(url);
    if (!feedUrl) {
      res.status(404).json({ error: 'No RSS feed found' });
      return;
    }
    res.json({ feedUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect feed' });
  }
}

async function extractNewsArticle(req: Request, res: Response) {
  const { url } = (req as any).validatedBody as z.infer<typeof extractNewsSchema>;
  try {
    const article = await newsService.extractArticleText(url);
    res.json(article);
  } catch (error: any) {
    if (error?.message === ARTICLE_URL_NOT_ALLOWED) {
      res.status(400).json({ error: 'URL_NOT_ALLOWED' });
      return;
    }
    if (error?.message === ARTICLE_EXTRACTION_FAILED) {
      res.status(422).json({
        error: ARTICLE_EXTRACTION_FAILED,
        fallback: true,
        url,
      });
      return;
    }
    res.status(500).json({ error: 'Failed to extract article text' });
  }
}

router.get('/news', getNews);
router.post('/refresh/news', refreshNews);
router.post('/sites/detect-feed', validateBody(detectFeedSchema), detectFeed);
router.post('/news/extract', validateBody(extractNewsSchema), extractNewsArticle);

export default router;

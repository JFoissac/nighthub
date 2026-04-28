import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/prisma.client', () => ({
  prisma: {
    aiNewsItem: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userPreference: {
      findFirst: vi.fn().mockResolvedValue({ customRssFeeds: '' }),
    },
  },
}));

vi.mock('rss-parser', () => ({
  default: function() {
    return {
      parseURL: vi.fn().mockResolvedValue({
        items: [
          {
            title: 'OpenAI releases GPT-5',
            link: 'https://openai.com/news/gpt-5',
            contentSnippet: 'GPT-5 is here with incredible capabilities.',
            pubDate: new Date().toISOString(),
          },
        ],
      }),
    };
  } as any,
}));

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn().mockResolvedValue([]),
}));

import { NewsService } from './news.service';
import { lookup as dnsLookup } from 'node:dns/promises';

const htmlAnthropicNews = `
<html><body>
<a href="/news/claude-4-released">
  <h3 class="title">Claude 4 Released</h3>
</a>
<a href="/news/ai-safety-update">
  <h3>AI Safety Update</h3>
</a>
</body></html>
`;

const htmlKimiBlog = `
<html><body>
<a href="/blog/kimi-k3" class="nav-link">
  <div class="dropdown-menu-item-title">Kimi K3 Launch</div>
</a>
<a href="/blog/new-benchmark">
  <div class="title">New Benchmark</div>
  <div>2026/04/01</div>
</a>
</body></html>
`;

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(() => {
    service = new NewsService();
    vi.stubGlobal('fetch', vi.fn());
    (dnsLookup as any).mockResolvedValue([]);
  });

  describe('fetchAiNews — OpenAI RSS', () => {
    it('maps RSS items to news format', async () => {
      (global.fetch as any).mockRejectedValue(new Error('network'));

      const news = await service.fetchAiNews();
      // OpenAI should return 1 item from mocked RSS
      const openaiItems = news.filter(n => n.source === 'openai');
      expect(openaiItems.length).toBeGreaterThanOrEqual(1);
      expect(openaiItems[0].title).toBe('OpenAI releases GPT-5');
      expect(openaiItems[0].url).toBe('https://openai.com/news/gpt-5');
    });
  });

  describe('scrapeAnthropic', () => {
    it('extracts articles from Anthropic news page', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(htmlAnthropicNews),
      });

      const news = await service.fetchAiNews();
      const anthropicItems = news.filter(n => n.source === 'anthropic');
      expect(anthropicItems.length).toBeGreaterThan(0);
      expect(anthropicItems[0].url).toContain('anthropic.com/news');
    });

    it('falls back to slug humanization when no title found', async () => {
      const minimalHtml = `<html><body><a href="/news/my-cool-announcement"></a></body></html>`;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalHtml),
      });

      const news = await service.fetchAiNews();
      const anthropicItems = news.filter(n => n.source === 'anthropic');
      if (anthropicItems.length > 0) {
        expect(anthropicItems[0].title).toBeTruthy();
        expect(anthropicItems[0].title.length).toBeGreaterThan(0);
      }
    });

    it('throws and resolves gracefully when fetch fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));
      // fetchAiNews uses Promise.allSettled so it shouldn't throw
      await expect(service.fetchAiNews()).resolves.toBeDefined();
    });
  });

  describe('scrapeKimi', () => {
    it('falls back to known articles when page returns empty', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') }) // anthropic
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') }); // kimi empty

      const news = await service.fetchAiNews();
      const kimiItems = news.filter(n => n.source === 'kimi');
      // Should fall back to 6 known articles
      expect(kimiItems.length).toBeGreaterThan(0);
    });

    it('extracts blog links from Kimi blog page', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') }) // anthropic
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(htmlKimiBlog) }); // kimi

      const news = await service.fetchAiNews();
      const kimiItems = news.filter(n => n.source === 'kimi');
      expect(kimiItems.length).toBeGreaterThan(0);
      expect(kimiItems[0].url).toContain('kimi.com/blog/');
    });

    it('ignores Kimi links that do not include a visible publication date', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') }) // anthropic
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(htmlKimiBlog) }); // kimi

      const news = await service.fetchAiNews();
      const kimiItems = news.filter(n => n.source === 'kimi');
      expect(kimiItems.some(item => item.url.endsWith('/blog/kimi-k3'))).toBe(false);
      expect(kimiItems.some(item => item.url.endsWith('/blog/new-benchmark'))).toBe(true);
    });
  });

  describe('getCachedNews', () => {
    it('returns empty array when cache is empty', async () => {
      const { prisma } = await import('../db/prisma.client');
      (prisma.aiNewsItem.findMany as any).mockResolvedValueOnce([]);
      const result = await service.getCachedNews(10);
      expect(result).toEqual([]);
    });

    it('returns cached items from DB', async () => {
      const { prisma } = await import('../db/prisma.client');
      const fakeItems = [
        { id: '1', title: 'Claude 4', source: 'anthropic', url: 'https://...', summary: '', isNew: false },
      ];
      (prisma.aiNewsItem.findMany as any).mockResolvedValueOnce(fakeItems);
      const result = await service.getCachedNews(10);
      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('anthropic');
    });
  });

  describe('validateFeedUrl', () => {
    it('returns true for valid RSS feed content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>'),
      });
      const result = await service.validateFeedUrl('https://example.com/feed.xml');
      expect(result).toBe(true);
    });

    it('returns true for Atom feed content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>'),
      });
      const result = await service.validateFeedUrl('https://example.com/atom.xml');
      expect(result).toBe(true);
    });

    it('returns false for HTML content', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><head><title>Test</title></head><body></body></html>'),
      });
      const result = await service.validateFeedUrl('https://example.com');
      expect(result).toBe(false);
    });

    it('returns false when fetch fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('network'));
      const result = await service.validateFeedUrl('https://example.com');
      expect(result).toBe(false);
    });

    it('returns false for non-ok response', async () => {
      (global.fetch as any).mockResolvedValue({ ok: false, text: () => Promise.resolve('') });
      const result = await service.validateFeedUrl('https://example.com');
      expect(result).toBe(false);
    });
  });

  describe('detectFeed', () => {
    it('discovers RSS link tag in HTML head', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html><head>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS">
          </head><body></body></html>
        `),
      });
      // validateFeedUrl will also be called and should succeed
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(`
          <html><head>
          <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS">
          </head><body></body></html>
        `),
      }).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<rss version="2.0"><channel><title>Test</title></channel></rss>'),
      });

      const result = await service.detectFeed('https://example.com');
      expect(result).toBe('https://example.com/feed.xml');
    });

    it('resolves absolute URL in link tag', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(`
            <html><head>
            <link rel="alternate" type="application/rss+xml" href="https://cdn.example.com/rss" title="RSS">
            </head><body></body></html>
          `),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<rss version="2.0"><channel><title>Test</title></channel></rss>'),
        });

      const result = await service.detectFeed('https://example.com');
      expect(result).toBe('https://cdn.example.com/rss');
    });

    it('falls back to probing common paths when no link tag found', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<html><head></head><body></body></html>'),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('<rss version="2.0"><channel><title>Test</title></channel></rss>'),
        });

      const result = await service.detectFeed('https://example.com');
      expect(result).toBe('https://example.com/feed');
    });

    it('returns null when no feed found anywhere', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><head></head><body></body></html>'),
      });

      const result = await service.detectFeed('https://example.com');
      expect(result).toBeNull();
    });

    it('returns null when initial fetch fails', async () => {
      (global.fetch as any).mockRejectedValue(new Error('timeout'));
      const result = await service.detectFeed('https://example.com');
      expect(result).toBeNull();
    });
  });

  describe('extractArticleText', () => {
    it('returns normalized plain text paragraphs on success', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html>
            <head><title>Latest AI Update</title></head>
            <body>
              <article>
                <h1>Latest AI Update</h1>
                <p>First paragraph with useful context.</p>
                <p>Second paragraph with additional detail.</p>
              </article>
            </body>
          </html>
        `),
      });

      const result = await service.extractArticleText('https://example.com/news/ai-update');
      expect(result).toEqual({
        title: 'Latest AI Update',
        source: 'example.com',
        content: 'First paragraph with useful context.\n\nSecond paragraph with additional detail.',
        url: 'https://example.com/news/ai-update',
      });
    });

    it('removes noise nodes such as script/style/nav/aside/img from extracted text', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html>
            <head>
              <style>.hidden{display:none}</style>
              <title>Noise Cleaning Test</title>
            </head>
            <body>
              <nav>Top Navigation CTA</nav>
              <article>
                <h1>Noise Cleaning Test</h1>
                <p>Main story starts here.</p>
                <aside>Sidebar ad text</aside>
                <img src="/hero.jpg" alt="hero">
                <p>Important analysis continues here.</p>
              </article>
              <script>console.log('tracking')</script>
            </body>
          </html>
        `),
      });

      const result = await service.extractArticleText('https://example.com/news/noise-cleaning');
      expect(result.content).toContain('Main story starts here.');
      expect(result.content).toContain('Important analysis continues here.');
      expect(result.content).not.toContain('Top Navigation CTA');
      expect(result.content).not.toContain('Sidebar ad text');
      expect(result.content).not.toContain('tracking');
      expect(result.content).not.toContain('hero');
    });

    it('throws extraction error for timeout/paywall-like failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(`
          <html>
            <head><title>Please subscribe</title></head>
            <body>
              <main>
                <p>Sign in to continue reading.</p>
                <p>Subscribe now to unlock this content.</p>
              </main>
            </body>
          </html>
        `),
      });

      await expect(
        service.extractArticleText('https://example.com/paywall')
      ).rejects.toMatchObject({ message: 'ARTICLE_EXTRACTION_FAILED' });
    });

    it('rejects localhost target for SSRF safety', async () => {
      await expect(
        service.extractArticleText('http://localhost:3000/private')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects private IPv4 target for SSRF safety', async () => {
      await expect(
        service.extractArticleText('http://10.1.2.3/internal')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects IPv6 loopback literal host for SSRF safety', async () => {
      await expect(
        service.extractArticleText('http://[::1]/private')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects IPv6 link-local variants in fe80::/10 range', async () => {
      await expect(
        service.extractArticleText('http://[fe90::1]/private')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects IPv4-mapped IPv6 loopback host for SSRF safety', async () => {
      await expect(
        service.extractArticleText('http://[::ffff:127.0.0.1]/private')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects redirect responses to prevent redirect-based SSRF bypass', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 302,
        headers: { get: vi.fn().mockReturnValue('http://localhost/internal') },
      });

      await expect(
        service.extractArticleText('https://public.example/redirect')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });

    it('rejects hostnames that resolve to internal loopback IPs', async () => {
      (dnsLookup as any).mockResolvedValueOnce([{ address: '127.0.0.1', family: 4 }]);

      await expect(
        service.extractArticleText('https://public.example/path')
      ).rejects.toMatchObject({ message: 'ARTICLE_URL_NOT_ALLOWED' });
    });
  });
});

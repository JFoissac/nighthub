import { TestBed } from '@angular/core/testing';
import { AiNewsService } from './ai-news.service';

describe('AiNewsService', () => {
  let service: AiNewsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiNewsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getNews', () => {
    it('should return a signal of news items', () => {
      const news = service.getNews();
      expect(news).toBeDefined();
      expect(typeof news).toBe('function');
    });

    it('should return initial mock data', () => {
      const news = service.getNews()();
      expect(news).toBeDefined();
      expect(Array.isArray(news)).toBe(true);
      expect(news.length).toBeGreaterThan(0);
    });

    it('should have items with required properties', () => {
      const news = service.getNews()();
      const firstItem = news[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('source');
      expect(firstItem).toHaveProperty('url');
      expect(firstItem).toHaveProperty('summary');
      expect(firstItem).toHaveProperty('timestamp');
    });

    it('should have valid source values', () => {
      const news = service.getNews()();
      const validSources = ['anthropic', 'openai', 'kimi'];
      news.forEach(item => {
        expect(validSources).toContain(item.source);
      });
    });
  });

  describe('refresh', () => {
    it('should not throw when called', () => {
      expect(() => service.refresh()).not.toThrow();
    });
  });
});
import { TestBed } from '@angular/core/testing';
import { TrumpService } from './trump.service';

describe('TrumpService', () => {
  let service: TrumpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TrumpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getItems', () => {
    it('should return a signal of items', () => {
      const items = service.getItems();
      expect(items).toBeDefined();
      expect(typeof items).toBe('function');
    });

    it('should return initial mock data', () => {
      const items = service.getItems()();
      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('should have items with required properties', () => {
      const items = service.getItems()();
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('type');
      expect(firstItem).toHaveProperty('url');
      expect(firstItem).toHaveProperty('timestamp');
    });

    it('should have valid type values', () => {
      const items = service.getItems()();
      const validTypes = ['tweet', 'decision', 'scandal', 'statement'];
      items.forEach(item => {
        expect(validTypes).toContain(item.type);
      });
    });
  });

  describe('refresh', () => {
    it('should not throw when called', () => {
      expect(() => service.refresh()).not.toThrow();
    });
  });
});
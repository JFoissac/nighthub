import { TestBed } from '@angular/core/testing';
import { TwitchService } from './twitch.service';

describe('TwitchService', () => {
  let service: TwitchService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TwitchService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getStreams', () => {
    it('should return a signal of streams', () => {
      const streams = service.getStreams();
      expect(streams).toBeDefined();
      expect(typeof streams).toBe('function');
    });

    it('should return initial mock data', () => {
      const streams = service.getStreams()();
      expect(streams).toBeDefined();
      expect(Array.isArray(streams)).toBe(true);
      expect(streams.length).toBeGreaterThan(0);
    });

    it('should have streams with required properties', () => {
      const streams = service.getStreams()();
      const firstStream = streams[0];
      expect(firstStream).toHaveProperty('id');
      expect(firstStream).toHaveProperty('title');
      expect(firstStream).toHaveProperty('thumbnailUrl');
      expect(firstStream).toHaveProperty('viewerCount');
      expect(firstStream).toHaveProperty('channelName');
      expect(firstStream).toHaveProperty('isLive');
      expect(firstStream).toHaveProperty('url');
    });

    it('should have numeric viewer counts', () => {
      const streams = service.getStreams()();
      streams.forEach(stream => {
        expect(typeof stream.viewerCount).toBe('number');
      });
    });
  });

  describe('refresh', () => {
    it('should not throw when called', () => {
      expect(() => service.refresh()).not.toThrow();
    });

    it('should preserve stream ids after refresh', () => {
      const originalStreams = service.getStreams()();
      service.refresh();
      const newStreams = service.getStreams()();

      expect(newStreams.length).toBe(originalStreams.length);
      newStreams.forEach((stream, index) => {
        expect(stream.id).toBe(originalStreams[index].id);
      });
    });
  });
});

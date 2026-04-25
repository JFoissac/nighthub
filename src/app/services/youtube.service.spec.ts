import { TestBed } from '@angular/core/testing';
import { YoutubeService } from './youtube.service';
import { YoutubeVideo } from '../models';

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(YoutubeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getVideos', () => {
    it('should return a signal of videos', () => {
      const videos = service.getVideos();
      expect(videos).toBeDefined();
      expect(typeof videos).toBe('function');
    });

    it('should return initial mock data', () => {
      const videos = service.getVideos()();
      expect(videos).toBeDefined();
      expect(Array.isArray(videos)).toBe(true);
      expect(videos.length).toBeGreaterThan(0);
    });

    it('should have videos with required properties', () => {
      const videos = service.getVideos()();
      const firstVideo = videos[0];
      expect(firstVideo).toHaveProperty('id');
      expect(firstVideo).toHaveProperty('title');
      expect(firstVideo).toHaveProperty('thumbnailUrl');
      expect(firstVideo).toHaveProperty('channelName');
      expect(firstVideo).toHaveProperty('duration');
      expect(firstVideo).toHaveProperty('views');
      expect(firstVideo).toHaveProperty('url');
    });

    it('should have numeric view counts', () => {
      const videos = service.getVideos()();
      videos.forEach(video => {
        expect(typeof video.views).toBe('number');
      });
    });
  });

  describe('refresh', () => {
    it('should not throw when called', () => {
      expect(() => service.refresh()).not.toThrow();
    });

    it('should preserve video ids after refresh', () => {
      const originalVideos = service.getVideos()();
      service.refresh();
      const newVideos = service.getVideos()();

      expect(newVideos.length).toBe(originalVideos.length);
      newVideos.forEach((video, index) => {
        expect(video.id).toBe(originalVideos[index].id);
      });
    });
  });
});
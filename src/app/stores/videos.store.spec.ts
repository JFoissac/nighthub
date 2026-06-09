import { TestBed } from '@angular/core/testing';
import { VideosStore } from './videos.store';
import { ApiService } from '../services/api.service';
import { YoutubeVideo } from '../models';
import { of, throwError } from 'rxjs';
import { patchState } from '@ngrx/signals';

const mockVideo = (id: string, title: string): YoutubeVideo => ({
  id,
  youtubeId: id,
  title,
  thumbnailUrl: `https://img.com/${id}.jpg`,
  channelName: 'TestChannel',
  channelAvatar: 'https://avatar.com/avatar.jpg',
  duration: '10:00',
  views: 1000,
  url: `https://youtube.com/watch?v=${id}`,
  isLive: false,
});

describe('VideosStore', () => {
  let store: any;
  let mockApi: any;

  beforeEach(() => {
    mockApi = {
      getVideos: jest.fn(),
      getNews: jest.fn(),
      getTweets: jest.fn(),
      getStreams: jest.fn(),
      getTrumpTweets: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: mockApi },
      ],
    });
    store = TestBed.inject(VideosStore) as any;
    patchState(store, { items: [], loading: false, atEnd: false, error: null });
  });

  describe('initial state', () => {
    it('should have empty items', () => {
      expect(store.items()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.loading()).toBe(false);
    });

    it('should not be at end', () => {
      expect(store.atEnd()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('videos should return items', () => {
      expect(store.videos()).toEqual([]);
    });

    it('isLoading should return loading state', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('count should return 0 when no items', () => {
      expect(store.count()).toBe(0);
    });

    it('count should return items length', () => {
      patchState(store, { items: [mockVideo('1', 'Video 1')] });
      expect(store.count()).toBe(1);
    });

    it('hasError should return false when no error', () => {
      expect(store.hasError()).toBe(false);
    });

    it('hasError should return true when error exists', () => {
      patchState(store, { error: 'Network failure' });
      expect(store.hasError()).toBe(true);
    });
  });

  describe('loadMore', () => {
    it('should call apiService.getVideos and update items on success', () => {
      const videos = [mockVideo('1', 'Video 1'), mockVideo('2', 'Video 2')];
      mockApi.getVideos.mockReturnValue(of(videos));
      store.loadMore();
      expect(mockApi.getVideos).toHaveBeenCalled();
      expect(store.items()).toEqual(videos);
      expect(store.loading()).toBe(false);
    });

    it('should set atEnd when response has fewer items than requested', () => {
      const videos = [mockVideo('1', 'Video 1')];
      mockApi.getVideos.mockReturnValue(of(videos));
      store.loadMore();
      expect(store.atEnd()).toBe(true);
    });

    it('should not set atEnd when response has full amount', () => {
      const videos = Array(20).fill(null).map((_, i) => mockVideo(String(i), `Video ${i}`));
      mockApi.getVideos.mockReturnValue(of(videos));
      store.loadMore();
      expect(store.atEnd()).toBe(false);
    });

    it('should set error on API failure', () => {
      mockApi.getVideos.mockReturnValue(throwError(() => new Error('Network error')));
      store.loadMore();
      expect(store.error()).toContain('Network error');
      expect(store.loading()).toBe(false);
    });

    it('should reset error on new loadMore call', () => {
      patchState(store, { error: 'Previous error' });
      mockApi.getVideos.mockReturnValue(of([]));
      store.loadMore();
      expect(store.error()).toBeNull();
    });
  });

  describe('reload', () => {
    it('should reset items and atEnd before reloading', () => {
      const videos = [mockVideo('1', 'Video 1')];
      mockApi.getVideos.mockReturnValue(of(videos));
      store.reload();
      expect(store.items()).toEqual(videos);
      expect(store.loading()).toBe(false);
    });

    it('should trigger getVideos after reset', () => {
      const videos = [mockVideo('1', 'Video 1')];
      mockApi.getVideos.mockReturnValue(of(videos));
      store.reload();
      expect(mockApi.getVideos).toHaveBeenCalled();
    });
  });

  describe('setItems', () => {
    it('should set items and reset atEnd', () => {
      patchState(store, { atEnd: true });
      const videos = [mockVideo('1', 'Video 1'), mockVideo('2', 'Video 2')];
      store.setItems(videos);
      expect(store.items()).toEqual(videos);
      expect(store.atEnd()).toBe(false);
    });

    it('should replace existing items', () => {
      store.setItems([mockVideo('1', 'Video 1')]);
      store.setItems([mockVideo('2', 'Video 2'), mockVideo('3', 'Video 3')]);
      expect(store.count()).toBe(2);
    });
  });

  describe('clearError', () => {
    it('should set error to null', () => {
      patchState(store, { error: 'Some error' });
      store.clearError();
      expect(store.error()).toBeNull();
    });
  });
});

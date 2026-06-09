import { TestBed } from '@angular/core/testing';
import { TrumpStore } from './trump.store';
import { ApiService } from '../services/api.service';
import { TrumpItem } from '../models';
import { of, throwError } from 'rxjs';
import { patchState } from '@ngrx/signals';

const mockTrump = (id: string, criticality: number): TrumpItem => ({
  id,
  tweetId: `tweet_${id}`,
  content: `Trump content ${id}`,
  type: 'tweet',
  criticality,
  sentiment: 'neutral',
  keywords: 'test',
  url: `https://example.com/${id}`,
  likes: 100,
  retweets: 20,
  isBreaking: false,
  tweetDate: new Date(),
});

describe('TrumpStore', () => {
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
    store = TestBed.inject(TrumpStore) as any;
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
    it('items should return store items', () => {
      expect(store.items()).toEqual([]);
    });

    it('isLoading should return loading state', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('count should return items length', () => {
      patchState(store, { items: [mockTrump('1', 5), mockTrump('2', 8)] });
      expect(store.count()).toBe(2);
    });

    it('hasError should return true when error exists', () => {
      patchState(store, { error: 'API error' });
      expect(store.hasError()).toBe(true);
    });
  });

  describe('loadMore', () => {
    it('should call apiService.getTrumpTweets and update items', () => {
      const items = [mockTrump('1', 5), mockTrump('2', 8)];
      mockApi.getTrumpTweets.mockReturnValue(of(items));
      store.loadMore();
      expect(mockApi.getTrumpTweets).toHaveBeenCalled();
      expect(store.items()).toEqual(items);
      expect(store.loading()).toBe(false);
    });

    it('should set atEnd when response has fewer items', () => {
      const items = [mockTrump('1', 5)];
      mockApi.getTrumpTweets.mockReturnValue(of(items));
      store.loadMore();
      expect(store.atEnd()).toBe(true);
    });

    it('should not set atEnd when response is full', () => {
      const items = Array(20).fill(null).map((_, i) => mockTrump(String(i), 5));
      mockApi.getTrumpTweets.mockReturnValue(of(items));
      store.loadMore();
      expect(store.atEnd()).toBe(false);
    });

    it('should set error on API failure', () => {
      mockApi.getTrumpTweets.mockReturnValue(throwError(() => new Error('Fetch failed')));
      store.loadMore();
      expect(store.error()).toContain('Fetch failed');
      expect(store.loading()).toBe(false);
    });
  });

  describe('reload', () => {
    it('should reset state before reloading', () => {
      const items = [mockTrump('1', 5)];
      mockApi.getTrumpTweets.mockReturnValue(of(items));
      store.reload();
      expect(store.items()).toEqual(items);
      expect(store.loading()).toBe(false);
    });
  });

  describe('setItems', () => {
    it('should set items and reset atEnd', () => {
      patchState(store, { atEnd: true });
      const items = [mockTrump('1', 5)];
      store.setItems(items);
      expect(store.items()).toEqual(items);
      expect(store.atEnd()).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      patchState(store, { error: 'Error' });
      store.clearError();
      expect(store.error()).toBeNull();
    });
  });
});

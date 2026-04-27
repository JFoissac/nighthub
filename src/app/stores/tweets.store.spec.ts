import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { TweetsStore } from './tweets.store';
import { ApiService } from '../services/api.service';
import { TweetItem } from '../models';
import { of, throwError, Subject } from 'rxjs';
import { patchState } from '@ngrx/signals';

const mockTweet = (id: string): TweetItem => ({
  id,
  authorName: `User ${id}`,
  authorHandle: `@user_${id}`,
  authorAvatar: `https://avatar.com/${id}.jpg`,
  content: `Tweet content ${id}`,
  timestamp: new Date(),
  likes: 100,
  retweets: 20,
});

describe('TweetsStore', () => {
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
    store = TestBed.inject(TweetsStore) as any;
    patchState(store, { items: [], loading: false, error: null });
  });

  describe('initial state', () => {
    it('should have empty items', () => {
      expect(store.items()).toEqual([]);
    });

    it('should not be loading', () => {
      expect(store.loading()).toBe(false);
    });

    it('should have no error', () => {
      expect(store.error()).toBeNull();
    });
  });

  describe('computed signals', () => {
    it('tweets should return items', () => {
      expect(store.tweets()).toEqual([]);
    });

    it('isLoading should return loading state', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('count should return items length', () => {
      patchState(store, { items: [mockTweet('1'), mockTweet('2')] });
      expect(store.count()).toBe(2);
    });

    it('hasError should return true when error exists', () => {
      patchState(store, { error: 'API error' });
      expect(store.hasError()).toBe(true);
    });
  });

  describe('reload', () => {
    it('should call apiService.getTweets and update items on success', fakeAsync(() => {
      const items = [mockTweet('1'), mockTweet('2')];
      mockApi.getTweets.mockReturnValue(of(items));
      store.reload();
      tick(50);
      expect(mockApi.getTweets).toHaveBeenCalled();
      expect(store.items()).toEqual(items);
      expect(store.loading()).toBe(false);
    }));

    it('should set loading true before API call', (done) => {
      const subject = new Subject<any[]>();
      mockApi.getTweets.mockReturnValue(subject.asObservable());
      store.reload();
      setTimeout(() => {
        expect(store.loading()).toBe(true);
        subject.next([]);
        subject.complete();
        done();
      }, 0);
    });

    it('should set error on API failure', fakeAsync(() => {
      mockApi.getTweets.mockReturnValue(throwError(() => new Error('Network error')));
      store.reload();
      tick(50);
      expect(store.error()).toContain('Network error');
      expect(store.loading()).toBe(false);
    }));
  });

  describe('setItems', () => {
    it('should set items', () => {
      const items = [mockTweet('1'), mockTweet('2'), mockTweet('3')];
      store.setItems(items);
      expect(store.items()).toEqual(items);
      expect(store.count()).toBe(3);
    });

    it('should replace existing items', () => {
      store.setItems([mockTweet('1')]);
      store.setItems([mockTweet('2'), mockTweet('3')]);
      expect(store.count()).toBe(2);
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
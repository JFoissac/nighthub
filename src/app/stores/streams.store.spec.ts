import { TestBed } from '@angular/core/testing';
import { StreamsStore } from './streams.store';
import { ApiService } from '../services/api.service';
import { TwitchStream } from '../models';
import { of, throwError, Subject } from 'rxjs';
import { patchState } from '@ngrx/signals';

const mockStream = (id: string, isLive: boolean): TwitchStream => ({
  id,
  twitchId: id,
  title: `Stream ${id}`,
  thumbnailUrl: `https://twitch.tv/${id}.jpg`,
  viewerCount: isLive ? 1000 : 0,
  channelName: `Channel_${id}`,
  channelAvatar: `https://twitch.tv/${id}_avatar.jpg`,
  gameName: 'Just Chatting',
  isLive,
  url: `https://twitch.tv/${id}`,
});

describe('StreamsStore', () => {
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
    store = TestBed.inject(StreamsStore) as any;
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
    it('streams should return items', () => {
      expect(store.streams()).toEqual([]);
    });

    it('isLoading should return loading state', () => {
      expect(store.isLoading()).toBe(false);
    });

    it('count should return items length', () => {
      patchState(store, { items: [mockStream('1', true), mockStream('2', false)] });
      expect(store.count()).toBe(2);
    });

    it('liveCount should return number of live streams', () => {
      patchState(store, {
        items: [mockStream('1', true), mockStream('2', false), mockStream('3', true)],
      });
      expect(store.liveCount()).toBe(2);
    });

    it('error should return error state', () => {
      patchState(store, { error: 'API error' });
      expect(store.error()).toBe('API error');
    });
  });

  describe('reload', () => {
    it('should call apiService.getStreams and update items on success', () => {
      const items = [mockStream('1', true), mockStream('2', false)];
      mockApi.getStreams.mockReturnValue(of(items));
      store.reload();
      expect(mockApi.getStreams).toHaveBeenCalled();
      expect(store.items()).toEqual(items);
      expect(store.loading()).toBe(false);
    });

    it('should set loading true before API call', () => {
      const subject = new Subject<any[]>();
      mockApi.getStreams.mockReturnValue(subject.asObservable());
      store.reload();
      expect(store.loading()).toBe(true);
      subject.next([]);
      subject.complete();
      expect(store.loading()).toBe(false);
    });

    it('should set error on API failure', () => {
      mockApi.getStreams.mockReturnValue(throwError(() => new Error('Network failure')));
      store.reload();
      expect(store.error()).toContain('Network failure');
      expect(store.loading()).toBe(false);
    });
  });

  describe('setItems', () => {
    it('should set items', () => {
      const items = [mockStream('1', true), mockStream('2', false)];
      store.setItems(items);
      expect(store.items()).toEqual(items);
      expect(store.count()).toBe(2);
    });

    it('should replace existing items', () => {
      store.setItems([mockStream('1', true)]);
      store.setItems([mockStream('2', false), mockStream('3', true)]);
      expect(store.count()).toBe(2);
    });
  });

});

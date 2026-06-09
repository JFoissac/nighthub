import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { TwitchStream } from '../models';

export interface StreamsState {
  items: TwitchStream[];
  gameFilter: string | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: StreamsState = {
  items: [],
  gameFilter: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

export const StreamsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
    _timer: null as any,
  })),

  withComputed((store) => ({
    streams: computed(() => store.items()),
    filteredStreams: computed(() => {
      const filter = store.gameFilter();
      if (!filter) return store.items();
      return store.items().filter(s => s.gameName === filter);
    }),
    gameList: computed(() => {
      const games = new Map<string, number>();
      store.items().forEach(s => {
        games.set(s.gameName, (games.get(s.gameName) || 0) + 1);
      });
      return [...games.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    }),
    count: computed(() => store.items().length),
    liveCount: computed(() => store.items().filter(s => s.isLive).length),
    isLoading: computed(() => store.loading()),
    isStale: computed(() => {
      const updated = store.lastUpdated();
      if (!updated) return true;
      return Date.now() - updated > 120_000;
    }),
  })),

  withMethods((store) => ({
    setItems(items: TwitchStream[]) {
      patchState(store, { items, loading: false, error: null, lastUpdated: Date.now() });
    },
    setLoading(loading: boolean) {
      patchState(store, { loading });
    },
    setGameFilter(game: string | null) {
      patchState(store, { gameFilter: game });
    },
    reload() {
      patchState(store, { loading: true, error: null });
      store._api.getStreams().subscribe({
        next: (items) => {
          patchState(store, { items, loading: false, lastUpdated: Date.now() });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    startAutoRefresh() {
      this.stopAutoRefresh();
      store._api.getPreferences().subscribe({
        next: (prefs) => {
          const minutes = prefs.streamsRefreshInterval ?? 5;
          const ms = Math.max(5000, minutes * 60 * 1000);
          store._timer = setInterval(() => this.reload(), ms);
        },
        error: () => {},
      });
    },

    stopAutoRefresh() {
      if (store._timer) {
        clearInterval(store._timer);
        store._timer = null;
      }
    },
  })),

  withHooks({
    onInit(store) {},
  })
);

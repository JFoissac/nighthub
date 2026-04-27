import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { TwitchStream } from '../models';

export interface StreamsState {
  items: TwitchStream[];
  gameFilter: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: StreamsState = {
  items: [],
  gameFilter: null,
  loading: false,
  error: null,
};

export const StreamsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
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
    isLoading: computed(() => store.loading()),
  })),
  withMethods((store) => ({
    setItems(items: TwitchStream[]) {
      patchState(store, { items });
    },
    setGameFilter(game: string | null) {
      patchState(store, { gameFilter: game });
    },
    reload() {
      patchState(store, { loading: true, error: null });
    },
  }))
);

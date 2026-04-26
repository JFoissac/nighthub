import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { TwitchStream } from '../models';

export interface StreamsState {
  items: TwitchStream[];
  loading: boolean;
  error: string | null;
}

const initialState: StreamsState = {
  items: [],
  loading: false,
  error: null,
};

export const StreamsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
  })),

  withComputed((store) => ({
    streams: computed(() => store.items()),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
    liveCount: computed(() => store.items().filter(s => s.isLive).length),
  })),

  withMethods((store) => ({
    reload() {
      patchState(store, { loading: true, error: null });
      store._api.getStreams().subscribe({
        next: (items) => {
          patchState(store, { items, loading: false });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    setItems(items: TwitchStream[]) {
      patchState(store, { items });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
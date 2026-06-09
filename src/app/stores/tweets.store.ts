import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { TweetItem } from '../models';

export interface TweetsState {
  items: TweetItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: TweetsState = {
  items: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

export const TweetsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
  })),

  withComputed((store) => ({
    tweets: computed(() => store.items()),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
    isStale: computed(() => {
      const updated = store.lastUpdated();
      if (!updated) return true;
      return Date.now() - updated > 120_000;
    }),
  })),

  withMethods((store) => ({
    reload() {
      patchState(store, { loading: true, error: null });
      store._api.getTweets(20).subscribe({
        next: (items) => {
          patchState(store, { items, loading: false, lastUpdated: Date.now() });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    setItems(items: TweetItem[]) {
      patchState(store, { items, lastUpdated: Date.now() });
    },

    clearError() {
      patchState(store, { error: null });
    },
  })),

  withHooks({
    onInit(store) {},
  })
);

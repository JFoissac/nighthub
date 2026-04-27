import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { TweetItem } from '../models';

export interface TweetsState {
  items: TweetItem[];
  loading: boolean;
  error: string | null;
}

const initialState: TweetsState = {
  items: [],
  loading: false,
  error: null,
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
  })),

  withMethods((store) => ({
    reload() {
      patchState(store, { loading: true, error: null });
      store._api.getTweets(20).subscribe({
        next: (items) => {
          patchState(store, { items, loading: false });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    setItems(items: TweetItem[]) {
      patchState(store, { items });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
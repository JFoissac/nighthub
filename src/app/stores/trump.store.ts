import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { TrumpItem } from '../models';

export interface TrumpState {
  items: TrumpItem[];
  loading: boolean;
  atEnd: boolean;
  error: string | null;
}

const initialState: TrumpState = {
  items: [],
  loading: false,
  atEnd: false,
  error: null,
};

export const TrumpStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
  })),

  withComputed((store) => ({
    items: computed(() => store.items()),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
  })),

  withMethods((store) => ({
    loadMore() {
      if (store.loading() || store.atEnd()) return;
      const next = Math.min(store.items().length + 20, 100);
      patchState(store, { loading: true, error: null });

      store._api.getTrumpTweets(next).subscribe({
        next: (items) => {
          patchState(store, {
            items,
            loading: false,
            atEnd: items.length < next,
          });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    reload() {
      patchState(store, { items: [], atEnd: false, error: null });
      this.loadMore();
    },

    setItems(items: TrumpItem[]) {
      patchState(store, { items, atEnd: false });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
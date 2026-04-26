import { computed, inject, signal } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { AiNewsItem } from '../models';

export interface NewsState {
  items: AiNewsItem[];
  loading: boolean;
  atEnd: boolean;
  error: string | null;
}

const initialState: NewsState = {
  items: [],
  loading: false,
  atEnd: false,
  error: null,
};

export const NewsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
  })),

  withComputed((store) => ({
    news: computed(() => store.items()),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
  })),

  withMethods((store) => ({
    loadMore() {
      if (store.loading() || store.atEnd()) return;
      const next = Math.min(store.items().length + 20, 100);
      patchState(store, { loading: true, error: null });

      store._api.getNews(next).subscribe({
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

    setItems(items: AiNewsItem[]) {
      patchState(store, { items, atEnd: false });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
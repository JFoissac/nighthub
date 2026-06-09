import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { AiNewsItem } from '../models';

export interface NewsState {
  items: AiNewsItem[];
  loading: boolean;
  atEnd: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: NewsState = {
  items: [],
  loading: false,
  atEnd: false,
  error: null,
  lastUpdated: null,
};

export const NewsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
    _timer: null as any,
  })),

  withComputed((store) => ({
    news: computed(() => store.items()),
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
            lastUpdated: Date.now(),
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

    setLoading(loading: boolean) {
      patchState(store, { loading });
    },

    setItems(items: AiNewsItem[]) {
      patchState(store, { items, atEnd: false, loading: false, error: null, lastUpdated: Date.now() });
    },

    clearError() {
      patchState(store, { error: null });
    },

    startAutoRefresh() {
      this.stopAutoRefresh();
      store._api.getPreferences().subscribe({
        next: (prefs) => {
          const minutes = prefs.newsRefreshInterval ?? 30;
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

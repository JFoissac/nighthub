import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { MarketTicker } from '../models';

export interface MarketState {
  items: MarketTicker[];
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: MarketState = {
  items: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

export const MarketStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
    _timer: null as ReturnType<typeof setInterval> | null,
  })),

  withComputed((store) => ({
    tickers: computed(() => store.items()),
    crypto: computed(() => store.items().filter(t => t.type === 'crypto')),
    stocks: computed(() => store.items().filter(t => t.type === 'stock')),
    groupedStocks: computed(() => {
      const groups = new Map<string, { key: string; label: string; tickers: MarketTicker[] }>();

      store.items()
        .filter((ticker) => ticker.type === 'stock')
        .forEach((ticker) => {
          const key = ticker.groupKey || 'indices';
          const label = ticker.groupLabel || 'INDICES & ETFS';
          const group = groups.get(key);

          if (group) {
            group.tickers.push(ticker);
            return;
          }

          groups.set(key, { key, label, tickers: [ticker] });
        });

      return [...groups.values()];
    }),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
    isStale: computed(() => {
      const updated = store.lastUpdated();
      if (!updated) return true;
      return Date.now() - updated > 90_000;
    }),
  })),

  withMethods((store) => ({
    reload() {
      patchState(store, { loading: true, error: null });
      store._api.getMarketData().subscribe({
        next: (items) => {
          patchState(store, { items, loading: false, lastUpdated: Date.now() });
        },
        error: (err) => {
          patchState(store, { loading: false, error: String(err) });
        },
      });
    },

    setItems(items: MarketTicker[]) {
      patchState(store, { items, loading: false, error: null, lastUpdated: Date.now() });
    },

    setLoading(loading: boolean) {
      patchState(store, { loading });
    },

    clearError() {
      patchState(store, { error: null });
    },

    startAutoRefresh() {
      this.stopAutoRefresh();
      store._api.getPreferences().subscribe({
        next: (prefs) => {
          const minutes = prefs.marketRefreshInterval ?? 1;
          const ms = Math.max(5000, minutes * 60 * 1000);
          store._timer = setInterval(() => this.reload(), ms);
        },
        error: () => undefined,
      });
    },

    stopAutoRefresh() {
      if (store._timer) {
        clearInterval(store._timer);
        store._timer = null;
      }
    },
  }))
);

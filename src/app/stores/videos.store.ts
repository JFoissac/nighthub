import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { YoutubeVideo } from '../models';

export interface VideosState {
  items: YoutubeVideo[];
  loading: boolean;
  atEnd: boolean;
  error: string | null;
  lastUpdated: number | null;
}

const initialState: VideosState = {
  items: [],
  loading: false,
  atEnd: false,
  error: null,
  lastUpdated: null,
};

export const VideosStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
    _timer: null as any,
  })),

  withComputed((store) => ({
    videos: computed(() => store.items()),
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

      store._api.getVideos(next).subscribe({
        next: (videos) => {
          patchState(store, {
            items: videos,
            loading: false,
            atEnd: videos.length < next,
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

    setItems(videos: YoutubeVideo[]) {
      patchState(store, { items: videos, atEnd: false, loading: false, error: null, lastUpdated: Date.now() });
    },

    clearError() {
      patchState(store, { error: null });
    },

    startAutoRefresh() {
      this.stopAutoRefresh();
      store._api.getPreferences().subscribe({
        next: (prefs) => {
          const minutes = prefs.youtubeRefreshInterval ?? 5;
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
  }))
);

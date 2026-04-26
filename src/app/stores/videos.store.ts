import { computed, inject } from '@angular/core';
import { signalStore, withState, withProps, withComputed, withMethods, patchState } from '@ngrx/signals';
import { ApiService } from '../services/api.service';
import { YoutubeVideo } from '../models';

export interface VideosState {
  items: YoutubeVideo[];
  loading: boolean;
  atEnd: boolean;
  error: string | null;
}

const initialState: VideosState = {
  items: [],
  loading: false,
  atEnd: false,
  error: null,
};

export const VideosStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withProps(() => ({
    _api: inject(ApiService),
  })),

  withComputed((store) => ({
    videos: computed(() => store.items()),
    isLoading: computed(() => store.loading()),
    hasError: computed(() => store.error() !== null),
    count: computed(() => store.items().length),
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

    setItems(videos: YoutubeVideo[]) {
      patchState(store, { items: videos, atEnd: false });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
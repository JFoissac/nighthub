import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  LucideAngularModule,
  RefreshCw,
  Monitor,
  Settings,
  SlidersHorizontal,
  X,
  ExternalLink,
  Rss,
  LoaderCircle,
  Calendar,
  Star,
  Plus,
  ChevronLeft,
  ChevronRight,
  Upload,
  Play,
  PanelRight,
  MapPin,
  ArrowLeft,
} from 'lucide-angular';
import { appRoutes } from './app.routes';
import { errorInterceptor } from './error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    importProvidersFrom(
      LucideAngularModule.pick({
        RefreshCw,
        Monitor,
        Settings,
        SlidersHorizontal,
        X,
        ExternalLink,
        Rss,
        LoaderCircle,
        Calendar,
        Star,
        Plus,
        ChevronLeft,
        ChevronRight,
        Upload,
        Play,
        PanelRight,
        MapPin,
        ArrowLeft,
      }),
    ),
  ],
};

import { Component, input, output, signal, OnDestroy, OnInit, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, RefreshCw, Monitor, Settings, SlidersHorizontal } from 'lucide-angular';
import { ApiService } from '../../services/api.service';
import { UserPreferences } from '../../models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="fixed top-0 w-full z-50 flex justify-between items-center px-4 h-12 bg-[#0a0a14]/90 backdrop-blur-md border-b border-[#1E1E2E]">
      <div class="flex items-center gap-6">
        <span class="text-xl font-black tracking-tighter text-primary font-headline uppercase">NIGHTHUB</span>
        <div class="hidden lg:flex items-center gap-4 pl-4 border-l border-[#1E1E2E]">
          <!-- Clock -->
          <span class="font-label-caps text-[10px] text-text-muted">{{ time() }}</span>

          <!-- Weather compact — clickable -->
          @if (weatherTemp() !== null) {
            <button (click)="openWeather.emit()"
                    class="flex items-center gap-1.5 hover:text-primary transition-colors group"
                    aria-label="Voir la météo détaillée">
              <span class="text-[13px]">{{ weatherIcon() }}</span>
              <span class="font-label-caps text-[10px] text-text-muted group-hover:text-primary">
                {{ weatherTemp() }}°C {{ weatherCity() | uppercase }}
              </span>
            </button>
          }

          <!-- Live streams count — clickable -->
          <button
            (click)="openStreamList.emit()"
            class="flex items-center gap-1.5 hover:text-primary transition-colors group"
            aria-label="Voir les streams en cours"
          >
            <span class="status-pulse" [class.status-pulse-green]="streamCount() > 0" [class.status-pulse-red]="streamCount() === 0"></span>
            <span class="font-label-caps text-[10px] text-text-muted group-hover:text-primary">
              LIVE: {{ streamCount() }}
            </span>
          </button>

        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          (click)="openRefresh.emit()"
          class="flex items-center gap-1.5 px-2 py-1 rounded border border-[#1E1E2E] text-text-muted hover:text-primary hover:border-primary/60 transition-all"
          [class.opacity-70]="isRefreshing()"
          [attr.aria-busy]="isRefreshing()"
          aria-label="Refresh dashboard"
        >
          <lucide-icon
            [name]="RefreshCw"
            size="14"
            [class]="isRefreshing() ? 'animate-spin' : ''"
          ></lucide-icon>
          <span class="font-label-caps text-[10px]">
            @if (isRefreshing()) {
              REFRESHING
            } @else if (refreshStatus() === 'updated' && lastUpdatedLabel()) {
              UPDATED {{ lastUpdatedLabel() }}
            } @else if (refreshStatus() === 'error') {
              RETRY
            } @else {
              REFRESH
            }
          </span>
        </button>
        <button
          (click)="toggleOled()"
          class="p-2.5 hover:bg-primary/10 text-text-muted hover:text-primary transition-all rounded"
          [title]="isOled() ? 'Disable OLED mode' : 'Enable OLED mode'"
          [attr.aria-pressed]="isOled()"
          aria-label="Toggle OLED dark mode"
        >
          <lucide-icon [name]="Monitor" size="16"></lucide-icon>
        </button>
        <button (click)="openOptions.emit()"
                class="p-2.5 hover:bg-primary/10 text-text-muted hover:text-primary transition-all rounded"
                aria-label="Options">
          <lucide-icon [name]="Settings" size="16"></lucide-icon>
        </button>
        <button (click)="openSources.emit()"
                class="p-2.5 hover:bg-primary/10 text-text-muted hover:text-primary transition-all rounded"
                aria-label="Sources">
          <lucide-icon [name]="SlidersHorizontal" size="16"></lucide-icon>
        </button>
      </div>
    </header>
  `,
})
export class HeaderComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  private prefs = signal<UserPreferences | null>(null);

  isOled = signal(false);
  time = signal(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

  // Weather data passed from dashboard
  weatherTemp = input<number | null>(null);
  weatherCity = input<string>('');
  weatherCondition = input<string>('');

  streamCount = input<number>(0);
  isRefreshing = input<boolean>(false);
  refreshStatus = input<'idle' | 'refreshing' | 'updated' | 'error'>('idle');
  lastUpdatedLabel = input<string>('');
  openOptions = output<void>();
  openSources = output<void>();
  openWeather = output<void>();
  openStreamList = output<void>();
  openRefresh = output<void>();

  readonly RefreshCw = RefreshCw;
  readonly Monitor = Monitor;
  readonly Settings = Settings;
  readonly SlidersHorizontal = SlidersHorizontal;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.intervalId = setInterval(() => {
      this.time.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);

    const prefsSub = this.apiService.getPreferences().subscribe({
      next: (prefs) => {
        this.prefs.set(prefs);
        const oled = prefs.themeOledBlack ?? false;
        this.isOled.set(oled);
        if (oled) {
          document.body.classList.add('theme-oled');
        } else {
          document.body.classList.remove('theme-oled');
        }
      },
    });

    this.destroyRef.onDestroy(() => {
      prefsSub.unsubscribe();
    });
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  toggleOled() {
    const newVal = !this.isOled();
    this.isOled.set(newVal);
    if (newVal) {
      document.body.classList.add('theme-oled');
    } else {
      document.body.classList.remove('theme-oled');
    }
    const currentPrefs = this.prefs();
    if (currentPrefs) {
      this.apiService.savePreferences({ ...currentPrefs, themeOledBlack: newVal }).subscribe();
    }
  }

  weatherIcon(): string {
    const c = (this.weatherCondition() || '').toLowerCase();
    if (c.includes('orage') || c.includes('storm') || c.includes('thunder')) return '⛈';
    if (c.includes('neige') || c.includes('snow')) return '❄️';
    if (c.includes('pluie forte') || c.includes('heavy rain')) return '🌧';
    if (c.includes('pluie') || c.includes('rain') || c.includes('drizzle')) return '🌦';
    if (c.includes('brouillard') || c.includes('fog')) return '🌫';
    if (c.includes('couvert') || c.includes('overcast')) return '☁️';
    if (c.includes('nuag') || c.includes('cloud')) return '⛅';
    if (c.includes('soleil') || c.includes('clear') || c.includes('sun')) return '☀️';
    return '🌤️';
  }
}

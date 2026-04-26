import { Component, input, output, signal, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
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
                    title="Voir la météo détaillée">
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
            title="Voir les streams en cours"
          >
            <span class="status-pulse" [class.status-pulse-green]="streamCount() > 0" [class.status-pulse-red]="streamCount() === 0"></span>
            <span class="font-label-caps text-[10px] text-text-muted group-hover:text-primary">
              LIVE: {{ streamCount() }}
            </span>
          </button>

          <!-- Stats -->
          <div class="hidden xl:flex items-center gap-3 pl-3 border-l border-[#1E1E2E]">
            <span class="font-label-caps text-[10px] text-text-muted">VID: {{ videoCount() }}</span>
            <span class="font-label-caps text-[10px] text-text-muted">NEWS: {{ newsCount() }}</span>
            <span class="font-label-caps text-[10px] text-text-muted">TWEETS: {{ tweetCount() }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div class="relative hidden md:block">
          <input class="bg-[#131318] border border-[#1E1E2E] rounded px-3 py-1 font-label-caps text-[10px] focus:outline-none focus:border-primary transition-all w-40 text-text-secondary placeholder-text-muted" placeholder="TERMINAL SEARCH..." type="text"/>
        </div>
        <button (click)="openSettings.emit()"
                class="p-1.5 hover:bg-primary/10 text-text-muted hover:text-primary transition-all rounded"
                title="Configuration">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button (click)="refresh.emit()"
                class="p-1.5 hover:bg-primary/10 text-text-muted hover:text-primary transition-all rounded"
                title="Refresh">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>
    </header>
  `,
})
export class HeaderComponent implements OnInit, OnDestroy {
  time = signal(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

  // Weather data passed from dashboard
  weatherTemp = input<number | null>(null);
  weatherCity = input<string>('');
  weatherCondition = input<string>('');

  // Stats passed from dashboard
  streamCount = input<number>(0);
  videoCount = input<number>(0);
  newsCount = input<number>(0);
  tweetCount = input<number>(0);

  refresh = output<void>();
  openSettings = output<void>();
  openWeather = output<void>();
  openStreamList = output<void>();

  private intervalId: any;

  ngOnInit() {
    this.intervalId = setInterval(() => {
      this.time.set(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
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

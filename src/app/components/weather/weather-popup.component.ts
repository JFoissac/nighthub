import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, MapPin, X } from 'lucide-angular';
import { WeatherForecast, WeatherDay } from '../../models';

@Component({
  selector: 'app-weather-popup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <!-- Backdrop -->
    <div role="presentation" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
         (click)="onBackdropClick($event)">

      <!-- Modal -->
      <div class="w-full max-w-2xl bg-[#12121A] border border-[#6366F1] shadow-[0_0_40px_rgba(99,102,241,0.2)] rounded overflow-hidden flex flex-col">

        <!-- Header -->
        <div class="border-b border-[#1E1E2E] px-md py-3 bg-[#12121A] flex justify-between items-start">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-[#6366F1] animate-pulse flex-shrink-0"></span>
              <h2 class="font-headline text-[20px] font-bold text-primary tracking-tight">NEO_METEO_HUB</h2>
              @if (forecast()?.source === 'live') {
                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span class="font-mono text-[9px] text-green-400">LIVE</span>
                </span>
              } @else if (forecast()?.source === 'cached') {
                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-500/10 border border-gray-500/20">
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                  <span class="font-mono text-[9px] text-gray-400">CACHED</span>
                </span>
              } @else if (forecast()?.source === 'error') {
                <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  <span class="font-mono text-[9px] text-red-400">ERROR</span>
                </span>
              }
            </div>
            <div class="flex items-center gap-1.5 text-text-muted">
              <lucide-icon [name]="MapPin" size="14"></lucide-icon>
              <span class="font-label-caps text-[10px]">{{ forecast()?.city || 'N/A' }}</span>
              @if (forecast()?.source === 'live') {
                <span class="font-mono text-[9px] text-text-muted" data-testid="freshness-indicator">mis à jour</span>
              }
            </div>
          </div>
          <button (click)="closed.emit()" class="p-1 text-text-muted hover:text-text-primary transition-colors">
            <lucide-icon [name]="X" size="20"></lucide-icon>
          </button>
        </div>

        <!-- Content -->
        <div class="p-md space-y-md overflow-y-auto max-h-[80vh]">

          @if (forecast()?.source === 'error') {
            <div class="text-center py-8">
              <p class="font-label-caps text-[11px] text-red-400">Données météo indisponibles. Vérifiez votre connexion ou réessayez plus tard.</p>
            </div>
          } @else if (forecast()?.days?.length) {

            <!-- Today highlight -->
            <div class="flex items-center gap-4 p-4 rounded border border-[#6366F1]/30 bg-[#6366F1]/10">
              <div class="text-5xl">{{ getIcon(forecast()!.days[0]) }}</div>
              <div class="flex-1">
                <div class="font-headline text-4xl font-bold text-text-primary">{{ forecast()!.days[0].temp }}°C</div>
                <div class="font-label-caps text-[10px] text-text-muted mt-1">{{ forecast()!.days[0].condition | uppercase }}</div>
              </div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-right">
                <span class="font-label-caps text-[9px] text-text-muted">MIN</span>
                <span class="font-label-caps text-[9px] text-text-muted">MAX</span>
                <span class="font-mono text-sm font-bold text-text-primary">{{ forecast()!.days[0].tempMin }}°</span>
                <span class="font-mono text-sm font-bold text-text-primary">{{ forecast()!.days[0].tempMax }}°</span>
                <span class="font-label-caps text-[9px] text-text-muted col-span-2 mt-1">
                  💨 {{ forecast()!.days[0].wind }}km/h &nbsp; 💧 {{ forecast()!.days[0].humidity }}%
                </span>
              </div>
            </div>

            <!-- 7-Day Forecast -->
            <section>
              <div class="flex items-center justify-between mb-3">
                <span class="font-label-caps text-[11px] text-[#6366F1]">WEATHER_SEQUENCE_07D</span>
                <span class="font-mono text-[10px] text-text-muted">PRECISION: HIGH</span>
              </div>
              <div class="grid grid-cols-7 gap-1.5">
                @for (day of forecast()!.days.slice(0, 7); track day.dayIndex) {
                  <div class="rounded p-2 flex flex-col items-center gap-1.5 transition-all hover:border-[#6366F1]/50 cursor-default"
                       [class]="$index === 0
                         ? 'bg-[#6366F1]/10 border border-[#6366F1]/40'
                         : 'bg-[#1A1A26] border border-[#1E1E2E] hover:bg-[#6366F1]/5'">
                    <span class="font-label-caps text-[9px]"
                          [class]="$index === 0 ? 'text-[#c0c1ff]' : 'text-text-muted'">
                      {{ getDayShort(day.forecastDate) }}
                    </span>
                    <span class="text-xl">{{ getIcon(day) }}</span>
                    <div class="flex flex-col items-center">
                      <span class="font-mono text-[13px] font-bold text-text-primary">{{ day.tempMax }}°</span>
                      <span class="font-mono text-[10px] text-text-muted">{{ day.tempMin }}°</span>
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- 3-Day detail bars -->
            <section>
              <span class="font-label-caps text-[11px] text-[#6366F1] block mb-3">3D_PRECISION_VIEW</span>
              <div class="space-y-2">
                @for (day of forecast()!.days.slice(0, 3); track day.dayIndex) {
                  <div class="flex items-center gap-4 p-3 rounded bg-[#1A1A26] border border-[#1E1E2E]">
                    <span class="font-label-caps text-[10px] text-text-muted w-8 flex-shrink-0">{{ getDayShort(day.forecastDate) }}</span>
                    <span class="text-lg">{{ getIcon(day) }}</span>
                    <div class="flex-1">
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-mono text-[10px] text-text-muted">{{ day.tempMin }}°</span>
                        <span class="font-mono text-[10px] text-text-muted">{{ day.tempMax }}°</span>
                      </div>
                      <div class="h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
                        <div class="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                             [style.width.%]="getTempBarWidth(day)"></div>
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <span class="font-mono text-sm font-bold text-text-primary">{{ day.temp }}°C</span>
                      <div class="font-label-caps text-[9px] text-text-muted">{{ day.precipitation }}mm</div>
                    </div>
                  </div>
                }
              </div>
            </section>

          } @else {
            <div class="text-center py-8">
              <p class="font-label-caps text-[11px] text-text-muted animate-pulse">LOADING WEATHER DATA...</p>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="bg-[#1A1A26] border-t border-[#1E1E2E] px-md py-3 flex justify-between items-center">
          <span class="font-mono text-[10px] text-text-muted uppercase">
            SOURCE: OPEN-METEO API
          </span>
          <button (click)="closed.emit()"
                  class="bg-[#6366F1] hover:bg-[#4f52d4] text-white font-label-caps text-[11px] px-5 py-1.5 rounded transition-all active:scale-95 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            CLOSE
          </button>
        </div>
      </div>
    </div>
  `,
})
export class WeatherPopupComponent {
  readonly MapPin = MapPin;
  readonly X = X;

  forecast = input<WeatherForecast | null>(null);
  closed = output<void>();

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  getIcon(day: WeatherDay): string {
    if (!day) return '🌤️';
    const c = day.condition.toLowerCase();
    if (c.includes('orage') || c.includes('storm') || c.includes('thunder')) return '⛈';
    if (c.includes('neige') || c.includes('snow')) return '❄️';
    if (c.includes('pluie forte') || c.includes('heavy rain')) return '🌧';
    if (c.includes('pluie') || c.includes('rain') || c.includes('drizzle')) return '🌦';
    if (c.includes('brouillard') || c.includes('fog') || c.includes('mist')) return '🌫';
    if (c.includes('couvert') || c.includes('overcast')) return '☁️';
    if (c.includes('nuag') || c.includes('cloud')) return '⛅';
    if (c.includes('soleil') || c.includes('clear') || c.includes('sun')) return '☀️';
    return '🌤️';
  }

  getDayShort(date: Date | string): string {
    const d = new Date(date);
    return ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'][d.getDay()];
  }

  getTempBarWidth(day: WeatherDay): number {
    // Scale: -10°C = 0%, 40°C = 100%
    const range = 50;
    const min = -10;
    const centerTemp = (day.tempMin + day.tempMax) / 2;
    return Math.min(100, Math.max(0, ((centerTemp - min) / range) * 100));
  }
}

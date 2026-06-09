import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeatherForecast, WeatherDay } from '../../models';

@Component({
  selector: 'app-weather',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (forecast()?.source === 'error') {
      <div class="h-full flex flex-col items-center justify-center gap-2 text-text-secondary">
        <div class="text-4xl">⚠️</div>
        <div class="text-sm text-red-400">Données météo indisponibles. Vérifiez votre connexion.</div>
      </div>
    } @else if (forecast()?.days?.length) {
      <div class="space-y-3">
        <!-- Today highlight -->
        <div class="flex items-center gap-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <div class="text-4xl">{{ getIcon(forecast()!.days[0]) }}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <div class="font-headline text-3xl font-bold text-text-primary">{{ forecast()!.days[0].temp }}°</div>
              @if (forecast()?.source === 'live') {
                <span class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Live" data-testid="live-indicator"></span>
              } @else if (forecast()?.source === 'cached') {
                <span class="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" title="Cached"></span>
              }
            </div>
            <div class="text-text-secondary text-xs">{{ forecast()!.days[0].condition }}</div>
          </div>
          <div class="text-right text-xs text-text-secondary">
            <div>{{ forecast()!.days[0].tempMin }}° / {{ forecast()!.days[0].tempMax }}°</div>
            <div class="flex items-center gap-1 mt-1 justify-end">
              <span>💨</span> {{ forecast()!.days[0].wind }}km/h
            </div>
            <div class="flex items-center gap-1 justify-end">
              <span>💧</span> {{ forecast()!.days[0].humidity }}%
            </div>
          </div>
        </div>

        <!-- Week forecast -->
        <div class="grid grid-cols-6 gap-1">
          @for (day of forecast()!.days.slice(1, 7); track day.dayIndex) {
            <div class="text-center p-2 rounded-lg hover:bg-surface/80 transition-colors">
              <div class="text-xs text-text-secondary font-medium">{{ getDayName(day.forecastDate) }}</div>
              <div class="text-xl my-1">{{ getIcon(day) }}</div>
              <div class="text-sm font-bold text-text-primary">{{ day.tempMax }}°</div>
              <div class="text-xs text-text-secondary">{{ day.tempMin }}°/{{ day.tempMax }}°</div>
            </div>
          }
        </div>

        <div class="text-center text-xs text-text-secondary pt-1">
          <span class="text-primary">📍</span> {{ forecast()!.city || 'Caen' }}
        </div>
      </div>
    } @else {
      <div class="h-full flex flex-col items-center justify-center gap-2 text-text-secondary">
        <div class="text-4xl animate-pulse">⏳</div>
        <div class="text-sm">Chargement météo...</div>
      </div>
    }
  `,
})
export class WeatherComponent {
  forecast = input<WeatherForecast | null>(null);

  getIcon(day: WeatherDay): string {
    if (!day) return '🌤️';
    const condition = day.condition.toLowerCase();
    if (condition.includes('orage') || condition.includes('storm') || condition.includes('thunder')) return '⛈';
    if (condition.includes('neige') || condition.includes('snow')) return '❄️';
    if (condition.includes('pluie forte') || condition.includes('heavy rain')) return '🌧';
    if (condition.includes('pluie') || condition.includes('rain') || condition.includes('drizzle')) return '🌦';
    if (condition.includes('brouillard') || condition.includes('fog') || condition.includes('mist')) return '🌫';
    if (condition.includes('couvert') || condition.includes('overcast')) return '☁️';
    if (condition.includes('nuag') || condition.includes('cloud')) return '⛅';
    if (condition.includes('soleil') || condition.includes('clear') || condition.includes('sun')) return '☀️';
    return '🌤️';
  }

  getDayName(date: Date | string): string {
    const d = new Date(date);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    return days[d.getDay()];
  }
}

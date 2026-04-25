import { Injectable, signal } from '@angular/core';
import { WeatherForecast } from '../models';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private forecast = signal<WeatherForecast>({
    city: 'Caen',
    days: [],
  });

  getForecast() {
    return this.forecast;
  }

  setCity(city: string) {
    this.forecast.update(f => ({ ...f, city }));
  }
}

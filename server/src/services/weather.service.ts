import { prisma } from '../db/prisma.client';
import { logger } from '../utils/logger';

// WMO Weather interpretation codes (https://open-meteo.com/en/docs)
function getWeatherDescription(code: number): string {
  const map: Record<number, string> = {
    0: 'Ensoleillé',
    1: 'Principalement dégagé',
    2: 'Partiellement nuageux',
    3: 'Couvert',
    45: 'Brouillard',
    48: 'Brouillard givrant',
    51: 'Bruine légère',
    53: 'Bruine modérée',
    55: 'Bruine dense',
    56: 'Bruine verglaçante légère',
    57: 'Bruine verglaçante dense',
    61: 'Pluie légère',
    63: 'Pluie modérée',
    65: 'Pluie forte',
    66: 'Pluie verglaçante légère',
    67: 'Pluie verglaçante forte',
    71: 'Neige légère',
    73: 'Neige modérée',
    75: 'Neige forte',
    77: 'Grains de neige',
    80: 'Averses de pluie légères',
    81: 'Averses de pluie modérées',
    82: 'Averses de pluie violentes',
    85: 'Averses de neige légères',
    86: 'Averses de neige fortes',
    95: 'Orage léger ou modéré',
    96: 'Orage avec grêle légère',
    99: 'Orage avec grêle forte',
  };
  return map[code] || 'Couvert';
}

export class WeatherService {
  private static readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1h
  private cache: { data: any; fetchedAt: number } | null = null;
  private fetchInFlight: Promise<any> | null = null;

  async getWeeklyForecast(city: string = 'Caen'): Promise<any> {
    // P1 : cache-first — un cache <1h est servi sans aucun appel réseau
    // (mesuré : 2 appels open-meteo systématiques à chaque appel avant).
    if (this.cache && Date.now() - this.cache.fetchedAt < WeatherService.CACHE_TTL_MS) {
      return this.cache.data;
    }
    // Dédup des appels concurrents (refreshAll + rebuild dashboard au boot).
    if (this.fetchInFlight) {
      return this.fetchInFlight;
    }
    this.fetchInFlight = this.fetchWeeklyForecast(city).finally(() => {
      this.fetchInFlight = null;
    });
    return this.fetchInFlight;
  }

  private async fetchWeeklyForecast(city: string = 'Caen'): Promise<any> {
    try {
      // 1. Geocode city to lat/lon
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`;
      const geoResponse = await fetch(geoUrl);
      if (!geoResponse.ok) {
        logger.error('Geocoding API error', { status: geoResponse.status });
        return this.getCachedOrError(city, 'Open-Meteo geocoding failed');
      }
      const geoData = await geoResponse.json();
      if (!geoData.results || geoData.results.length === 0) {
        logger.error('Geocoding no results', { city });
        return this.getCachedOrError(city, 'City not found');
      }
      const { latitude, longitude, name } = geoData.results[0];

      // 2. Fetch forecast
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,weather_code,precipitation_sum,wind_speed_10m_max,relative_humidity_2m_mean&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation&timezone=auto&forecast_days=8`;
      const forecastResponse = await fetch(forecastUrl);
      if (!forecastResponse.ok) {
        logger.error('Open-Meteo forecast API error', { status: forecastResponse.status });
        return this.getCachedOrError(city, 'Open-Meteo forecast API failed');
      }
      const data = await forecastResponse.json();

      // 3. Build days array
      const days: any[] = [];
      const daily = data.daily;
      const current = data.current;

      for (let i = 0; i < daily.time.length && i < 8; i++) {
        const dateStr = daily.time[i];
        const isToday = i === 0;
        const temp = isToday
          ? Math.round(current.temperature_2m)
          : Math.round(daily.temperature_2m_mean[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const condition = getWeatherDescription(daily.weather_code[i]);
        const wind = isToday
          ? Math.round(current.wind_speed_10m)
          : Math.round(daily.wind_speed_10m_max[i]);
        const humidity = isCurrentAvailable(current)
          ? (isToday ? current.relative_humidity_2m : daily.relative_humidity_2m_mean[i])
          : 70;
        const precipitation = isToday
          ? (current.precipitation || 0)
          : (daily.precipitation_sum[i] || 0);

        days.push({
          city: name,
          temp,
          tempMin,
          tempMax,
          condition,
          icon: String(daily.weather_code[i]),
          wind,
          humidity,
          precipitation: Math.round(precipitation),
          forecastDate: new Date(dateStr),
          dayIndex: i,
        });
      }

      await this.cacheWeeklyForecast(days);
      const result = { city: name, days, source: 'live' };
      this.cache = { data: result, fetchedAt: Date.now() };
      return result;
    } catch (error) {
      logger.error('Weather service error', error);
      return this.getCachedOrError(city, 'Open-Meteo service unavailable');
    }
  }

  // Keep legacy single-day method for backward compatibility
  async getWeather(city: string = 'Caen'): Promise<any> {
    const forecast = await this.getWeeklyForecast(city);
    if (forecast?.days?.[0]) {
      return forecast.days[0];
    }
    return forecast;
  }

  private async getCachedOrError(city: string, errorMessage: string): Promise<any> {
    const cached = await this.getCachedWeeklyForecast(city);
    if (cached) return cached;
    return {
      city,
      error: `${errorMessage}. Please try again later.`,
      source: 'error',
    };
  }

  private async cacheWeeklyForecast(days: any[]): Promise<void> {
    try {
      if (days.length > 0) {
        await prisma.weatherCache.deleteMany({
          where: { city: days[0].city },
        });
      }

      for (const day of days) {
        await prisma.weatherCache.create({
          data: {
            city: day.city,
            temp: day.temp,
            tempMin: day.tempMin,
            tempMax: day.tempMax,
            condition: day.condition,
            wind: day.wind,
            humidity: day.humidity,
            precipitation: day.precipitation,
            icon: day.icon,
            forecastDate: day.forecastDate,
            dayIndex: day.dayIndex,
            source: 'live',
          },
        });
      }
    } catch (error) {
      logger.error('Cache weekly forecast error', error);
    }
  }

  private async getCachedWeeklyForecast(city: string): Promise<any> {
    try {
      const cached = await prisma.weatherCache.findMany({
        where: { city },
        orderBy: { dayIndex: 'asc' },
      });

      if (cached.length > 0) {
        return {
          city,
          days: cached.map(c => ({
            city: c.city,
            temp: c.temp,
            tempMin: c.tempMin,
            tempMax: c.tempMax,
            condition: c.condition,
            icon: c.icon,
            wind: c.wind,
            humidity: c.humidity,
            precipitation: c.precipitation,
            forecastDate: c.forecastDate,
            dayIndex: c.dayIndex,
          })),
          source: 'cached',
        };
      }
    } catch (error) {
      logger.error('Get cached weekly forecast error', error);
    }

    return null;
  }
}

function isCurrentAvailable(current: any): current is { relative_humidity_2m: number; wind_speed_10m: number; temperature_2m: number; weather_code: number; precipitation: number } {
  return (
    current &&
    typeof current.relative_humidity_2m === 'number' &&
    typeof current.wind_speed_10m === 'number' &&
    typeof current.temperature_2m === 'number'
  );
}

export function createWeatherService(): WeatherService {
  return new WeatherService();
}

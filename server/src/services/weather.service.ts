import { prisma } from '../db/prisma.client';
import { config } from '../config/env';

export class WeatherService {
  async getWeeklyForecast(city: string = 'Caen'): Promise<any> {
    try {
      const apiKey = config.openWeatherMap.apiKey;
      if (!apiKey) {
        return this.getCachedWeeklyForecast(city);
      }

      // Get current weather
      const currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      const currentResponse = await fetch(currentUrl);

      // Get 5-day/3-hour forecast (free tier) and aggregate by day
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`;
      const forecastResponse = await fetch(forecastUrl);

      if (!currentResponse.ok || !forecastResponse.ok) {
        console.error('Weather API error:', currentResponse.status, forecastResponse.status);
        return this.getCachedWeeklyForecast(city);
      }

      const currentData = await currentResponse.json();
      const forecastData = await forecastResponse.json();

      // Build today's weather
      const today = {
        city: currentData.name,
        temp: Math.round(currentData.main.temp),
        tempMin: Math.round(currentData.main.temp_min),
        tempMax: Math.round(currentData.main.temp_max),
        condition: currentData.weather[0].description,
        icon: currentData.weather[0].icon,
        wind: Math.round(currentData.wind.speed * 3.6),
        humidity: currentData.main.humidity,
        precipitation: currentData.rain?.['1h'] || currentData.rain?.['3h'] || 0,
        forecastDate: new Date(),
        dayIndex: 0,
      };

      // Aggregate forecast by day
      const dailyMap = new Map<string, any[]>();
      for (const item of forecastData.list) {
        const date = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, []);
        }
        dailyMap.get(date)!.push(item);
      }

      const dailyForecasts: any[] = [today];
      let dayIndex = 1;

      for (const [dateStr, items] of dailyMap) {
        if (dayIndex > 6) break;

        const temps = items.map((i: any) => i.main.temp);
        const winds = items.map((i: any) => i.wind.speed);
        const humidities = items.map((i: any) => i.main.humidity);

        // Pick the midday entry for condition/icon, or first available
        const middayEntry = items.find((i: any) => i.dt_txt.includes('12:00:00')) || items[0];

        const rain = items.reduce((sum: number, i: any) => {
          return sum + (i.rain?.['3h'] || 0);
        }, 0);

        dailyForecasts.push({
          city: currentData.name,
          temp: Math.round(temps.reduce((a: number, b: number) => a + b, 0) / temps.length),
          tempMin: Math.round(Math.min(...temps)),
          tempMax: Math.round(Math.max(...temps)),
          condition: middayEntry.weather[0].description,
          icon: middayEntry.weather[0].icon,
          wind: Math.round((winds.reduce((a: number, b: number) => a + b, 0) / winds.length) * 3.6),
          humidity: Math.round(humidities.reduce((a: number, b: number) => a + b, 0) / humidities.length),
          precipitation: Math.round(rain),
          forecastDate: new Date(dateStr),
          dayIndex,
        });

        dayIndex++;
      }

      await this.cacheWeeklyForecast(dailyForecasts);
      return { city: currentData.name, days: dailyForecasts };
    } catch (error) {
      console.error('Weather service error:', error);
      return this.getCachedWeeklyForecast(city);
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

  private async cacheWeeklyForecast(days: any[]): Promise<void> {
    try {
      // Delete old forecasts for this city
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
          },
        });
      }
    } catch (error) {
      console.error('Cache weekly forecast error:', error);
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
        };
      }
    } catch (error) {
      console.error('Get cached weekly forecast error:', error);
    }

    return this.getMockWeeklyForecast(city);
  }

  private getMockWeeklyForecast(city: string): any {
    const conditions = [
      { condition: 'Partiellement nuageux', icon: '03d' },
      { condition: 'Ensoleille', icon: '01d' },
      { condition: 'Pluie legere', icon: '10d' },
      { condition: 'Nuageux', icon: '04d' },
      { condition: 'Ensoleille', icon: '01d' },
      { condition: 'Couvert', icon: '04d' },
      { condition: 'Pluie moderee', icon: '10d' },
    ];

    const days = conditions.map((c, i) => ({
      city,
      temp: 14 + Math.round(Math.random() * 8),
      tempMin: 10 + Math.round(Math.random() * 4),
      tempMax: 18 + Math.round(Math.random() * 6),
      condition: c.condition,
      icon: c.icon,
      wind: 10 + Math.round(Math.random() * 20),
      humidity: 50 + Math.round(Math.random() * 30),
      precipitation: Math.round(Math.random() * 15),
      forecastDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
      dayIndex: i,
    }));

    return { city, days };
  }
}

export const weatherService = new WeatherService();

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing the service
vi.mock('../db/prisma.client', () => ({
  prisma: {
    weatherCache: {
      deleteMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { WeatherService } from './weather.service';
import { prisma } from '../db/prisma.client';

function createMockGeocodingResponse(name: string) {
  return {
    ok: true,
    json: async () => ({
      results: [
        {
          id: 1,
          name,
          latitude: 49.18585,
          longitude: -0.35912,
          country: 'France',
        },
      ],
    }),
  };
}

function createMockGeocodingEmptyResponse() {
  return {
    ok: true,
    json: async () => ({
      results: [],
    }),
  };
}

function createMockForecastResponse() {
  return {
    ok: true,
    json: async () => ({
      latitude: 49.18,
      longitude: -0.36,
      current: {
        time: '2026-06-09T22:15',
        interval: 900,
        temperature_2m: 13.7,
        relative_humidity_2m: 69,
        wind_speed_10m: 9.3,
        weather_code: 3,
        precipitation: 0.0,
      },
      daily: {
        time: [
          '2026-06-09',
          '2026-06-10',
          '2026-06-11',
          '2026-06-12',
          '2026-06-13',
          '2026-06-14',
          '2026-06-15',
          '2026-06-16',
        ],
        temperature_2m_max: [17.8, 17.6, 17.6, 21.9, 22.2, 25.9, 27.7, 22.5],
        temperature_2m_min: [9.2, 10.1, 9.6, 15.1, 13.0, 11.6, 14.9, 16.4],
        temperature_2m_mean: [13.5, 13.8, 13.9, 17.6, 17.1, 18.4, 21.0, 19.6],
        weather_code: [80, 3, 61, 3, 3, 45, 3, 3],
        precipitation_sum: [0, 0, 0, 0, 0, 0, 0, 0],
        wind_speed_10m_max: [12, 15, 20, 18, 22, 25, 28, 20],
        relative_humidity_2m_mean: [65, 60, 70, 55, 50, 45, 40, 55],
      },
    }),
  };
}

describe('WeatherService', () => {
  let service: WeatherService;
  let globalFetch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WeatherService();
    globalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = globalFetch;
  });

  describe('getWeeklyForecast', () => {
    it('should return 8 days with no duplicates', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce(createMockForecastResponse());

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('live');
      expect(result.days).toHaveLength(8);
      // Check today is index 0
      expect(result.days[0].dayIndex).toBe(0);
      // Check all dayIndex are unique
      const indices = result.days.map((d: any) => d.dayIndex);
      expect(new Set(indices).size).toBe(indices.length);
    });

    it('should have correct today min/max from Open-Meteo daily data', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce(createMockForecastResponse());

      const result = await service.getWeeklyForecast('Caen');

      const today = result.days[0];
      expect(today).toBeDefined();
      expect(today.tempMin).toBe(9);
      expect(today.tempMax).toBe(18);
      expect(today.temp).toBe(14);
    });

    it('should map WMO weather codes to French conditions', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce(createMockForecastResponse());

      const result = await service.getWeeklyForecast('Caen');

      const today = result.days[0];
      expect(today.condition).toBe('Averses de pluie légères');

      const tomorrow = result.days[1];
      expect(tomorrow.condition).toBe('Couvert');
    });

    it('should return source: "error" when geocoding fails (no cache)', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 });
      (prisma.weatherCache.findMany as any).mockResolvedValue([]);

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('error');
      expect(result.error).toContain('Open-Meteo geocoding failed');
      expect(result.days).toBeUndefined();
    });

    it('should return source: "error" when geocoding returns no results', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingEmptyResponse());
      (prisma.weatherCache.findMany as any).mockResolvedValue([]);

      const result = await service.getWeeklyForecast('UnknownCity');

      expect(result.source).toBe('error');
      expect(result.error).toContain('City not found');
    });

    it('should return source: "error" when forecast API fails (no cache)', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce({ ok: false, status: 500 });
      (prisma.weatherCache.findMany as any).mockResolvedValue([]);

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('error');
      expect(result.error).toContain('Open-Meteo forecast API failed');
    });

    it('should return source: "cached" when using cache fallback', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce({ ok: false, status: 500 });
      (prisma.weatherCache.findMany as any).mockResolvedValue([
        {
          city: 'Caen',
          temp: 16,
          tempMin: 10,
          tempMax: 20,
          condition: 'Ensoleillé',
          icon: '0',
          wind: 12,
          humidity: 55,
          precipitation: 0,
          forecastDate: new Date(),
          dayIndex: 0,
        },
      ]);

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('cached');
      expect(result.days).toBeDefined();
      expect(result.days.length).toBeGreaterThan(0);
    });

    it('should NOT return mock data when APIs fail', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce({ ok: false, status: 500 });
      (prisma.weatherCache.findMany as any).mockResolvedValue([]);

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('error');
      expect(result.days).toBeUndefined();
    });

    it('should include source: "live" in the response when API succeeds', async () => {
      globalThis.fetch = vi.fn()
        .mockResolvedValueOnce(createMockGeocodingResponse('Caen'))
        .mockResolvedValueOnce(createMockForecastResponse());

      const result = await service.getWeeklyForecast('Caen');

      expect(result.source).toBe('live');
      expect(result.days).toBeDefined();
      expect(result.city).toBe('Caen');
    });
  });
});

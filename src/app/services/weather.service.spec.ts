import { TestBed } from '@angular/core/testing';
import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WeatherService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getForecast', () => {
    it('should return a signal of forecast', () => {
      const forecast = service.getForecast();
      expect(forecast).toBeDefined();
      expect(typeof forecast).toBe('function');
    });

    it('should return valid forecast data', () => {
      const forecast = service.getForecast()();
      expect(forecast).toBeDefined();
      expect(forecast).toHaveProperty('city');
      expect(forecast).toHaveProperty('days');
    });

    it('should have array of days', () => {
      const forecast = service.getForecast()();
      expect(Array.isArray(forecast.days)).toBe(true);
    });

    it('should default city to Caen', () => {
      const forecast = service.getForecast()();
      expect(forecast.city).toBe('Caen');
    });
  });

  describe('setCity', () => {
    it('should update the city in forecast', () => {
      service.setCity('London');
      const forecast = service.getForecast()();
      expect(forecast.city).toBe('London');
    });

    it('should not throw when setting city', () => {
      expect(() => service.setCity('Berlin')).not.toThrow();
    });

    it('should preserve other forecast properties when setting city', () => {
      const originalForecast = service.getForecast()();
      service.setCity('Tokyo');
      const newForecast = service.getForecast()();

      expect(newForecast.days).toEqual(originalForecast.days);
    });
  });
});

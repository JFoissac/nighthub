import { TestBed } from '@angular/core/testing';
import { WeatherService } from './weather.service';
import { WeatherForecast } from '../models';

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
      expect(forecast).toHaveProperty('temp');
      expect(forecast).toHaveProperty('condition');
      expect(forecast).toHaveProperty('wind');
      expect(forecast).toHaveProperty('humidity');
      expect(forecast).toHaveProperty('city');
    });

    it('should have numeric temperature', () => {
      const forecast = service.getForecast()();
      expect(typeof forecast.temp).toBe('number');
    });

    it('should have string condition', () => {
      const forecast = service.getForecast()();
      expect(typeof forecast.condition).toBe('string');
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

      expect(newForecast.temp).toBe(originalForecast.temp);
      expect(newForecast.condition).toBe(originalForecast.condition);
      expect(newForecast.wind).toBe(originalForecast.wind);
    });
  });
});
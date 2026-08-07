import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherComponent } from './weather.component';
import { WeatherForecast } from '../../models';

function createMockForecast(overrides: Partial<WeatherForecast> = {}): WeatherForecast {
  return {
    city: 'Caen',
    days: Array.from({ length: 7 }, (_, i) => ({
      city: 'Caen',
      temp: 15 + i,
      tempMin: 10 + i,
      tempMax: 20 + i,
      condition: 'partiellement nuageux',
      icon: '02d',
      wind: 10 + i,
      humidity: 60 + i,
      precipitation: i,
      forecastDate: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
      dayIndex: i,
    })),
    ...overrides,
  } as WeatherForecast;
}

describe('WeatherComponent', () => {
  let component: WeatherComponent;
  let fixture: ComponentFixture<WeatherComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WeatherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have forecast input defined', () => {
    expect(component.forecast).toBeDefined();
  });

  describe('getIcon', () => {
    it('should return an emoji string', () => {
      const mockDay = {
        condition: 'Ensoleille',
        temp: 20,
        tempMin: 15,
        tempMax: 25,
        wind: 10,
        humidity: 60,
        precipitation: 0,
        icon: '01d',
        forecastDate: new Date(),
        dayIndex: 0,
      } as any;
      const icon = component.getIcon(mockDay);
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    });
  });

  it('should show "LIVE" indicator when source is "live"', () => {
    fixture.componentRef.setInput('forecast', createMockForecast({ source: 'live' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // The component should show a live indicator (badge, dot, or text)
    const hasLiveIndicator =
      compiled.textContent?.toUpperCase().includes('LIVE') ||
      compiled.querySelector('.bg-green') !== null ||
      compiled.querySelector('.text-green') !== null ||
      compiled.querySelector('[data-testid="live-indicator"]') !== null;
    expect(hasLiveIndicator).toBe(true);
  });

  it('should show error state when source is "error"', () => {
    fixture.componentRef.setInput('forecast', {
      city: 'Caen',
      days: [],
      source: 'error',
      error: 'Weather API unavailable. Please check your OPENWEATHERMAP_API_KEY.',
    } as WeatherForecast);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Should not show loading state when source is error
    expect(compiled.textContent).not.toContain('Chargement météo');
    // Should show some error indication
    const hasErrorIndicator =
      compiled.textContent?.toLowerCase().includes('indisponible') ||
      compiled.textContent?.toLowerCase().includes('erreur') ||
      compiled.textContent?.toLowerCase().includes('error') ||
      compiled.querySelector('.text-red') !== null ||
      compiled.querySelector('[data-testid="error-indicator"]') !== null;
    expect(hasErrorIndicator).toBe(true);
  });
});

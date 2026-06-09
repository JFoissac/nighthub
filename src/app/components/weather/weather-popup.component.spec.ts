import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherPopupComponent } from './weather-popup.component';
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

describe('WeatherPopupComponent', () => {
  let component: WeatherPopupComponent;
  let fixture: ComponentFixture<WeatherPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherPopupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WeatherPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show "LIVE" badge when source is "live"', () => {
    fixture.componentRef.setInput('forecast', createMockForecast({ source: 'live' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('LIVE');
  });

  it('should show error message when source is "error"', () => {
    fixture.componentRef.setInput('forecast', {
      city: 'Caen',
      days: [],
      source: 'error',
      error: 'Weather API unavailable. Please check your OPENWEATHERMAP_API_KEY.',
    } as WeatherForecast);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Données météo indisponibles');
    expect(compiled.textContent).toContain('Vérifiez votre connexion');
  });

  it('should show "CACHED" badge when source is "cached"', () => {
    fixture.componentRef.setInput('forecast', createMockForecast({ source: 'cached' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('CACHED');
  });

  it('should show "OPEN-METEO API" in footer', () => {
    fixture.componentRef.setInput('forecast', createMockForecast({ source: 'live' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('OPEN-METEO API');
    expect(compiled.textContent).not.toContain('OPENWEATHERMAP API');
  });

  it('should show a data freshness indicator when source is "live"', () => {
    fixture.componentRef.setInput('forecast', createMockForecast({ source: 'live' }));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Should contain some freshness indicator like "Mise à jour" or timestamp
    const hasFreshnessIndicator =
      compiled.textContent?.includes('Mise à jour') ||
      compiled.textContent?.includes('mis à jour') ||
      compiled.querySelector('[data-testid="freshness-indicator"]') !== null;
    expect(hasFreshnessIndicator).toBe(true);
  });
});

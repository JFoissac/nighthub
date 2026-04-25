import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherComponent } from './weather.component';
import { WeatherForecast } from '../../models';

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
});
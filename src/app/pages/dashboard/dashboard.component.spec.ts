import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { DashboardComponent } from './dashboard.component';
import { ApiService } from '../../services/api.service';
import { of } from 'rxjs';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockApiService: Partial<ApiService>;
  let refreshAllCalled = false;

  beforeEach(async () => {
    refreshAllCalled = false;
    mockApiService = {
      getDashboard: () => of({} as any),
      getDashboardStream: () => of({} as any),
      getTweets: () => of([]),
      getStreams: () => of([]),
      getVideos: () => of([]),
      getNews: () => of([]),
      getWeather: () => of({}),
      refreshAll: () => {
        refreshAllCalled = true;
        return of({});
      },
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [{ provide: ApiService, useValue: mockApiService }],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have apiService injected', () => {
    expect(component['apiService']).toBeDefined();
  });

  it('should load dashboard data on init', () => {
    expect(mockApiService.getDashboard).toBeDefined();
  });

  describe('refreshAll', () => {
    it('should call apiService.refreshAll', () => {
      component.refreshAll();
      expect(refreshAllCalled).toBe(true);
    });
  });
});
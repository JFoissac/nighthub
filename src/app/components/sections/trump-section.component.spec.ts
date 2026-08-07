import { signal } from '@angular/core';
import { fakeAsync, tick, ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TrumpSectionComponent } from './trump-section.component';
import { TrumpStore } from '../../stores/trump.store';
import { ApiService } from '../../services/api.service';
import { TrumpNewsService } from '../../services/trump-news.service';

const createTrumpStore = () => ({
  items: signal<any[]>([]),
  loading: signal(false),
  count: signal(0),
  isLoading: signal(false),
  hasError: signal(false),
  loadMore: jest.fn(),
  reload: jest.fn(),
  setLoading: jest.fn(),
  setItems: jest.fn(),
  clearError: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
});

describe('TrumpSectionComponent', () => {
  let fixture: ComponentFixture<TrumpSectionComponent>;
  let store: ReturnType<typeof createTrumpStore>;

  beforeEach(async () => {
    store = createTrumpStore();

    await TestBed.configureTestingModule({
      imports: [TrumpSectionComponent],
      providers: [
        { provide: TrumpStore, useValue: store },
        {
          provide: ApiService,
          useValue: { getTrumpTweets: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: TrumpNewsService,
          useValue: {
            getTrumpNews: jest.fn().mockReturnValue(of([
              { id: 'n1', title: 'Tirs contre Donald Trump', source: 'lemonde', isBreaking: true, criticality: 9, pubDate: new Date() },
            ])),
          },
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    fixture = TestBed.createComponent(TrumpSectionComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the TV/NEWS block with breaking items', fakeAsync(() => {
    fixture = TestBed.createComponent(TrumpSectionComponent);
    fixture.detectChanges(); // ngOnInit : les timers sont planifiés dans la zone fakeAsync
    tick(0); // exécute les setTimeout(0)
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('TV / NEWS');
    expect(text).toContain('BREAKING TV/NEWS');
    expect(text).toContain('Tirs contre Donald Trump');
  }));

  it('exposes hasBreakingNews computed signal', fakeAsync(() => {
    fixture = TestBed.createComponent(TrumpSectionComponent);
    fixture.detectChanges();
    tick(0);
    expect(fixture.componentInstance.hasBreakingNews()).toBe(true);
  }));

  it('shows no breaking badge when news are not breaking', fakeAsync(() => {
    const newsService = TestBed.inject(TrumpNewsService);
    (newsService.getTrumpNews as jest.Mock).mockReturnValue(of([
      { id: 'n2', title: 'Trump à la télévision', source: 'bfmtv', isBreaking: false, criticality: 4, pubDate: new Date() },
    ]));

    fixture = TestBed.createComponent(TrumpSectionComponent);
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();

    expect(fixture.componentInstance.hasBreakingNews()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Trump à la télévision');
    expect(fixture.nativeElement.textContent).not.toContain('BREAKING TV/NEWS');
  }));
});

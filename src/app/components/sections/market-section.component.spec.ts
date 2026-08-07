import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketSectionComponent } from './market-section.component';
import { MarketStore } from '../../stores/market.store';

const createMarketStore = () => {
  const items = signal<any[]>([]);
  const loading = signal(false);

  return {
    items,
    loading,
    count: signal(0),
    isLoading: loading,
    tickers: items,
    crypto: signal<any[]>([]),
    stocks: signal<any[]>([]),
    groupedStocks: signal<any[]>([]),
    hasError: signal(false),
    reload: jest.fn(),
    setLoading: jest.fn(),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
};

describe('MarketSectionComponent', () => {
  let fixture: ComponentFixture<MarketSectionComponent>;
  let component: MarketSectionComponent;
  let store: ReturnType<typeof createMarketStore>;

  beforeEach(async () => {
    store = createMarketStore();
    store.stocks.set([
      { symbol: 'NVDA', name: 'NVIDIA', type: 'stock', price: 100, change24h: 1, changePercent24h: 1, change7d: 2, changePercent7d: 2, groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
      { symbol: 'AMD', name: 'AMD', type: 'stock', price: 100, change24h: 1, changePercent24h: 1, change7d: 2, changePercent7d: 2, groupKey: 'ai', groupLabel: 'AI' },
    ]);
    store.groupedStocks.set([
      { key: 'magnificent-7', label: 'MAGNIFICENT 7', tickers: [store.stocks()[0]] },
      { key: 'ai', label: 'AI', tickers: [store.stocks()[1]] },
    ]);
    store.count.set(2);

    await TestBed.configureTestingModule({
      imports: [MarketSectionComponent],
    })
      .overrideProvider(MarketStore, { useValue: store })
      .compileComponents();

    fixture = TestBed.createComponent(MarketSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders stock group headings for grouped tickers', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('MAGNIFICENT 7');
    expect(text).toContain('AI');
    expect(text).toContain('NVDA');
    expect(text).toContain('AMD');
  });

  it('keeps list view as the default dashboard mode', () => {
    expect(component.viewMode()).toBe('list');
  });
});

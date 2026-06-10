export type StockGroupKey =
  | 'magnificent-7'
  | 'ai'
  | 'tech'
  | 'defense'
  | 'commodities'
  | 'indices';

export interface StockGroupMeta {
  key: StockGroupKey;
  label: string;
}

export interface TrackedStockMeta {
  symbol: string;
  name: string;
  display: string;
  groupKey: StockGroupKey;
  groupLabel: string;
}

export const STOCK_GROUPS: StockGroupMeta[] = [
  { key: 'magnificent-7', label: 'MAGNIFICENT 7' },
  { key: 'ai', label: 'AI' },
  { key: 'tech', label: 'TECH' },
  { key: 'defense', label: 'DEFENSE' },
  { key: 'commodities', label: 'COMMODITIES' },
  { key: 'indices', label: 'INDICES & ETFS' },
];

const GROUP_MAP = new Map(STOCK_GROUPS.map((group) => [group.key, group]));

export const TRACKED_STOCKS: TrackedStockMeta[] = [
  { symbol: 'AAPL', name: 'Apple', display: 'AAPL', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'MSFT', name: 'Microsoft', display: 'MSFT', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'GOOGL', name: 'Alphabet', display: 'GOOGL', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'AMZN', name: 'Amazon', display: 'AMZN', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'META', name: 'Meta', display: 'META', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'NVDA', name: 'NVIDIA', display: 'NVDA', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'TSLA', name: 'Tesla', display: 'TSLA', groupKey: 'magnificent-7', groupLabel: 'MAGNIFICENT 7' },
  { symbol: 'AMD', name: 'AMD', display: 'AMD', groupKey: 'ai', groupLabel: 'AI' },
  { symbol: 'AVGO', name: 'Broadcom', display: 'AVGO', groupKey: 'ai', groupLabel: 'AI' },
  { symbol: 'PLTR', name: 'Palantir', display: 'PLTR', groupKey: 'ai', groupLabel: 'AI' },
  { symbol: 'TSM', name: 'TSMC', display: 'TSM', groupKey: 'ai', groupLabel: 'AI' },
  { symbol: 'ORCL', name: 'Oracle', display: 'ORCL', groupKey: 'tech', groupLabel: 'TECH' },
  { symbol: 'CRM', name: 'Salesforce', display: 'CRM', groupKey: 'tech', groupLabel: 'TECH' },
  { symbol: 'ADBE', name: 'Adobe', display: 'ADBE', groupKey: 'tech', groupLabel: 'TECH' },
  { symbol: 'NOW', name: 'ServiceNow', display: 'NOW', groupKey: 'tech', groupLabel: 'TECH' },
  { symbol: 'LMT', name: 'Lockheed Martin', display: 'LMT', groupKey: 'defense', groupLabel: 'DEFENSE' },
  { symbol: 'NOC', name: 'Northrop Grumman', display: 'NOC', groupKey: 'defense', groupLabel: 'DEFENSE' },
  { symbol: 'RTX', name: 'RTX', display: 'RTX', groupKey: 'defense', groupLabel: 'DEFENSE' },
  { symbol: 'GD', name: 'General Dynamics', display: 'GD', groupKey: 'defense', groupLabel: 'DEFENSE' },
  { symbol: 'XOM', name: 'Exxon Mobil', display: 'XOM', groupKey: 'commodities', groupLabel: 'COMMODITIES' },
  { symbol: 'CVX', name: 'Chevron', display: 'CVX', groupKey: 'commodities', groupLabel: 'COMMODITIES' },
  { symbol: 'FCX', name: 'Freeport-McMoRan', display: 'FCX', groupKey: 'commodities', groupLabel: 'COMMODITIES' },
  { symbol: 'NEM', name: 'Newmont', display: 'NEM', groupKey: 'commodities', groupLabel: 'COMMODITIES' },
  { symbol: '^GSPC', name: 'S&P 500', display: 'SPX', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
  { symbol: '^IXIC', name: 'NASDAQ', display: 'IXIC', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
  { symbol: '^DJI', name: 'Dow Jones', display: 'DJI', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
  { symbol: '^VIX', name: 'VIX', display: 'VIX', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
  { symbol: 'SPY', name: 'SPDR S&P 500', display: 'SPY', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
  { symbol: 'QQQ', name: 'Invesco QQQ', display: 'QQQ', groupKey: 'indices', groupLabel: 'INDICES & ETFS' },
];

const STOCK_MAP = new Map(TRACKED_STOCKS.map((stock) => [stock.display, stock] as const));

export function getStockGroupMeta(key: StockGroupKey): StockGroupMeta | undefined {
  return GROUP_MAP.get(key);
}

export function getTrackedStockMeta(displaySymbol: string): TrackedStockMeta | undefined {
  return STOCK_MAP.get(displaySymbol);
}

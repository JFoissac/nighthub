import { describe, expect, it } from 'vitest';
import { STOCK_GROUPS, TRACKED_STOCKS, getStockGroupMeta, getTrackedStockMeta } from './market.catalog';

describe('market catalog', () => {
  it('includes all required dashboard stock groups', () => {
    expect(STOCK_GROUPS.map((group) => group.key)).toEqual([
      'magnificent-7',
      'ai',
      'tech',
      'defense',
      'commodities',
      'indices',
    ]);
  });

  it('maps representative tickers to the expected groups', () => {
    expect(getTrackedStockMeta('NVDA')).toMatchObject({ groupKey: 'magnificent-7' });
    expect(getTrackedStockMeta('AMD')).toMatchObject({ groupKey: 'ai' });
    expect(getTrackedStockMeta('ORCL')).toMatchObject({ groupKey: 'tech' });
    expect(getTrackedStockMeta('LMT')).toMatchObject({ groupKey: 'defense' });
    expect(getTrackedStockMeta('XOM')).toMatchObject({ groupKey: 'commodities' });
    expect(getTrackedStockMeta('QQQ')).toMatchObject({ groupKey: 'indices' });
  });

  it('exposes a readable label for each tracked stock group', () => {
    expect(getStockGroupMeta('magnificent-7')?.label).toBe('MAGNIFICENT 7');
    expect(getStockGroupMeta('ai')?.label).toBe('AI');
    expect(getStockGroupMeta('tech')?.label).toBe('TECH');
    expect(getStockGroupMeta('defense')?.label).toBe('DEFENSE');
    expect(getStockGroupMeta('commodities')?.label).toBe('COMMODITIES');
  });

  it('tracks more than macro indices so the dashboard can render stock groups', () => {
    expect(TRACKED_STOCKS.length).toBeGreaterThan(12);
  });
});

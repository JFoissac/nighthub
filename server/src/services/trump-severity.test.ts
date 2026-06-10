import { describe, expect, it } from 'vitest';
import { getTrumpSeverity, isTrumpBreaking } from './trump-severity';

describe('Trump severity', () => {
  it('uses stable thresholds for labels and visual bands', () => {
    expect(getTrumpSeverity(2)).toMatchObject({ level: 'low', label: 'FAIBLE' });
    expect(getTrumpSeverity(4)).toMatchObject({ level: 'medium', label: 'MOYEN' });
    expect(getTrumpSeverity(6)).toMatchObject({ level: 'high', label: 'IMPORTANT' });
    expect(getTrumpSeverity(8)).toMatchObject({ level: 'critical', label: 'CRITIQUE' });
  });

  it('treats 7+ criticality as breaking and below as non-breaking', () => {
    expect(isTrumpBreaking(6)).toBe(false);
    expect(isTrumpBreaking(7)).toBe(true);
    expect(isTrumpBreaking(10)).toBe(true);
  });
});

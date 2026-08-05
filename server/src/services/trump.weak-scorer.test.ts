import { describe, expect, it } from 'vitest';
import { scoreTrumpTextWeakly } from './trump.weak-scorer';

describe('Trump weak text scorer', () => {
  it('keeps neutral and promotional wording low', () => {
    const score = scoreTrumpTextWeakly('Congratulations to everyone, great rally tonight, thank you!');

    expect(score.score).toBeLessThanOrEqual(2);
    expect(score.bucket).toBe('LOW');
  });

  it('scores partisan attacks as medium tension', () => {
    const score = scoreTrumpTextWeakly('The Democrats are corrupt cheaters and thieves, fake news is the enemy!');

    expect(score.score).toBeGreaterThanOrEqual(3);
    expect(score.score).toBeLessThanOrEqual(5);
    expect(score.bucket).toBe('MEDIUM');
  });

  it('scores explicit military escalation near the top', () => {
    const score = scoreTrumpTextWeakly('We launch bomb on Iran and respond immediately with missiles.');

    expect(score.score).toBeGreaterThanOrEqual(9);
    expect(score.bucket).toBe('EXTREME');
    expect(score.triggeredRules).toContain('explicit_geopolitical_escalation');
  });

  it('guards against administrative emergency false positives', () => {
    const score = scoreTrumpTextWeakly('I will be approving an Emergency Declaration for Montana for severe storms.');

    expect(score.score).toBeLessThan(7);
    expect(score.bucket).not.toBe('EXTREME');
  });
});

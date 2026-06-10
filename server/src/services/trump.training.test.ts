import { describe, expect, it } from 'vitest';
import { buildTrumpTrainedProfile } from './trump.training';
import { scoreTrumpContent } from './trump.scoring';

describe('Trump training corpus', () => {
  it('pushes worldwide alert scenarios to the top bucket', () => {
    const profile = buildTrumpTrainedProfile();

    expect(scoreTrumpContent('Iran attacked our military and bombardment starts tonight.', profile)).toBe(10);
    expect(scoreTrumpContent('100% tariffs on all imports from China effective immediately.', profile)).toBe(10);
    expect(scoreTrumpContent('The Secretary of State has resigned effective immediately.', profile)).toBe(10);
  });

  it('keeps low-signal rally or vanity posts out of the breaking bucket', () => {
    const profile = buildTrumpTrainedProfile();

    expect(scoreTrumpContent('Thank you Michigan, incredible crowd tonight.', profile)).toBeLessThan(4);
    expect(scoreTrumpContent('Fake news is failing again, we are winning big.', profile)).toBeLessThan(4);
  });
});

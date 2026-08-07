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

  it('reserves 10/10 for true world-alert scenarios', () => {
    const profile = buildTrumpTrainedProfile();

    expect(scoreTrumpContent('The Pentagon and Treasury are coordinating an immediate sanctions package.', profile)).toBeLessThan(10);
    expect(scoreTrumpContent('Massive tariffs will hit foreign steel and auto imports if talks fail.', profile)).toBeLessThan(10);
    expect(scoreTrumpContent('Troops are being deployed after the missile strike and our response is coming.', profile)).toBeLessThan(10);
  });

  it('pushes endorsements, export headlines and admin appointments down the scale', () => {
    const profile = buildTrumpTrainedProfile();

    expect(scoreTrumpContent('Record $327.1 Billion Exports Help Shrink U.S. Trade Deficit.', profile)).toBeLessThan(6);
    expect(scoreTrumpContent('William Pulte will be taking over as Acting Director of National Intelligence.', profile)).toBeLessThan(7);
    expect(scoreTrumpContent('Congressman William Timmons has my Complete and Total Endorsement for Re-Election.', profile)).toBeLessThan(4);
  });
});

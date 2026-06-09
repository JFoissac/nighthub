import { describe, expect, it } from 'vitest';
import {
  buildTrumpScoringProfile,
  createDefaultTrumpScoringProfile,
  scoreTrumpContent,
} from './trump.scoring';

describe('Trump scoring model', () => {
  it('ignores empty content and RT-only posts', () => {
    const profile = createDefaultTrumpScoringProfile();

    expect(scoreTrumpContent('', profile)).toBe(0);
    expect(scoreTrumpContent('RT: https://truthsocial.com/users/realDonaldTrump/statuses/123', profile)).toBe(0);
  });

  it('treats major military escalation as 10/10', () => {
    const profile = createDefaultTrumpScoringProfile();

    const score = scoreTrumpContent(
      'Our military has been attacked by Iran and we will respond immediately with force.',
      profile,
    );

    expect(score).toBe(10);
  });

  it('treats massive tariffs and top-level resignations as 10/10', () => {
    const profile = createDefaultTrumpScoringProfile();

    expect(
      scoreTrumpContent('I am imposing 100% tariffs on all imports from China effective immediately.', profile),
    ).toBe(10);
    expect(
      scoreTrumpContent('The Secretary of State has resigned effective now after tonight\'s meeting.', profile),
    ).toBe(10);
  });

  it('learns useful phrases from stored high-criticality posts', () => {
    const learnedProfile = buildTrumpScoringProfile([
      {
        content: 'I am imposing export controls on advanced semiconductor equipment to China.',
        criticality: 10,
        isBreaking: true,
      },
      {
        content: 'A peaceful meeting at the White House today.',
        criticality: 1,
        isBreaking: false,
      },
    ]);
    const defaultProfile = createDefaultTrumpScoringProfile();

    const learnedScore = scoreTrumpContent('advanced semiconductor equipment', learnedProfile);
    const defaultScore = scoreTrumpContent('advanced semiconductor equipment', defaultProfile);

    expect(learnedScore).toBeGreaterThan(defaultScore);
    expect(learnedScore).toBeGreaterThanOrEqual(2);
  });
});

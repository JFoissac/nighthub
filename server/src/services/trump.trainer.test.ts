import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDefaultTrumpScoringProfile } from './trump.scoring';
import { TrumpTrainingService } from './trump.trainer';

describe('TrumpTrainingService', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('trains a persisted scoring profile from the local archive dataset', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'trump-training-'));
    const datasetPath = join(tempDir, 'tweets.json');
    const snapshotPath = join(tempDir, 'trained-profile.json');

    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          text: 'Congressman William Timmons has my Complete and Total Endorsement for Re-Election.',
          favorites: 100,
          retweets: 20,
          date: '2020-01-01 10:00:00',
        },
        {
          text: 'Record $327.1 Billion Exports Help Shrink U.S. Trade Deficit.',
          favorites: 80,
          retweets: 15,
          date: '2020-01-02 10:00:00',
        },
        {
          text: 'Iran attacked our military assets and we will respond immediately.',
          favorites: 2000,
          retweets: 900,
          date: '2020-01-03 10:00:00',
        },
      ]),
    );

    const service = new TrumpTrainingService({
      datasetPath,
      snapshotPath,
      intervalMs: 60_000,
    });

    const snapshot = await service.trainNow('test');

    if (!snapshot) {
      throw new Error('Expected a training snapshot');
    }
    expect(snapshot.archiveRecordCount).toBe(3);
    expect(snapshot.inferredRecordCount).toBeGreaterThanOrEqual(3);
    expect(snapshot.profile.learnedBoosts['complete and total endorsement']).toBeLessThan(0);
    expect(snapshot.profile.learnedBoosts['trade deficit']).toBeLessThan(0);
    expect(snapshot.profile.learnedBoosts['our military assets']).toBeGreaterThan(0);

    const rawSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    expect(rawSnapshot.reason).toBe('test');
    expect(rawSnapshot.profile.learnedBoosts['trade deficit']).toBeLessThan(0);
  });

  it('loads the persisted snapshot for live scoring reuse', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'trump-training-'));
    const datasetPath = join(tempDir, 'tweets.json');
    const snapshotPath = join(tempDir, 'trained-profile.json');

    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          text: 'Congressman William Timmons has my Complete and Total Endorsement for Re-Election.',
          favorites: 100,
          retweets: 20,
        },
        {
          text: 'Iran attacked our military assets and we will respond immediately.',
          favorites: 2000,
          retweets: 900,
        },
      ]),
    );

    const service = new TrumpTrainingService({
      datasetPath,
      snapshotPath,
      intervalMs: 60_000,
    });

    await service.trainNow('test');

    const reloaded = new TrumpTrainingService({
      datasetPath,
      snapshotPath,
      intervalMs: 60_000,
    });

    const trainedProfile = reloaded.getPersistedProfile();
    const defaultProfile = createDefaultTrumpScoringProfile();

    expect(trainedProfile.learnedBoosts['complete and total endorsement']).toBeLessThan(0);
    expect(trainedProfile.learnedBoosts['our military assets']).toBeGreaterThan(0);
    expect(Object.keys(trainedProfile.learnedBoosts).length).toBeGreaterThan(
      Object.keys(defaultProfile.learnedBoosts).length,
    );
  });
});

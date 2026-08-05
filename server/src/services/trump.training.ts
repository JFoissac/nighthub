import {
  buildTrumpScoringProfile,
  mergeTrumpScoringProfiles,
  type TrumpCorpusEntry,
  type TrumpScoringProfile,
} from './trump.scoring';
import { loadTrumpArchiveCorpusFromEnv } from './trump.archive';
import { TRUMP_TRAINING_CORPUS } from './trump.training-corpus';

export function buildTrumpTrainedProfile(
  records: TrumpCorpusEntry[] = [],
  backgroundProfile?: TrumpScoringProfile,
) {
  const archiveRecords = loadTrumpArchiveCorpusFromEnv();

  const corpusProfile = buildTrumpScoringProfile([
    ...TRUMP_TRAINING_CORPUS,
    ...archiveRecords,
    ...records,
  ]);

  return backgroundProfile
    ? mergeTrumpScoringProfiles(backgroundProfile, corpusProfile)
    : corpusProfile;
}
